# Supabase 数据说明

项目使用 10 张 `public` 表和 1 个私有对象存储桶，组成下面这条数据链路：

1. `energy_hourly_future` 保存完整的模拟数据源。
2. 每小时把下一个时间点的三个区域数据复制到 `energy_hourly`。
3. 训练任务读取 `energy_hourly`，比较多个参数组合，并发布最佳模型。
4. 生产任务读取当前模型，把未来 24 小时的预测写入 `energy_forecasts`。
5. 实际数据到达后，通过区域和目标时间关联预测，计算模型误差。

区域固定为 `AEP`、`DAYTON` 和 `DOM`。它们是 PJM 负荷区，不代表单一城市、变电站或客户。

## 表一览

| 表 | 作用 |
| --- | --- |
| `energy_hourly` | 保存模拟过程中已经到达的真实负荷和天气，是训练与生产预测的数据来源。 |
| `energy_hourly_future` | 保存完整、不可变的未来数据，按小时提供回放数据。 |
| `pred_static` | 保存初始静态模型的历史回测结果，仅用于对照。 |
| `pred_dynamic` | 保存模型对纽约本地 2016 年 1 月的动态回测结果。 |
| `simulation_state` | 保存小时回放进度，避免任务重试时重复推进。 |
| `training_experiments` | 保存一次完整调参实验的范围、状态和获胜实例。 |
| `training_trials` | 保存实验中每个参数组合及其 loss 和验证结果。 |
| `model_versions` | 保存已发布模型的版本、文件位置和启用状态。 |
| `forecast_runs` | 保存一次完整的每日预测任务。 |
| `energy_forecasts` | 保存每日预测任务产生的各区域、各时距预测值。 |

## 负荷与天气数据

### `energy_hourly`

保存当前模拟时间之前已经到达的真实数据。训练和生产预测只能读取这张表，不能提前读取尚未释放的未来数据。

### `energy_hourly_future`

保存完整的回放数据源。每小时从中读取下一个 `interval_end_utc`，并把该时点的 AEP、DAYTON、DOM 三行一起复制到 `energy_hourly`。源数据不会被删除，因此回放开始后两张表出现重叠是正常的。

两张表使用相同字段：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `zone` | `text` | 负荷区域，只能是 `AEP`、`DAYTON` 或 `DOM`。 |
| `interval_end_utc` | `timestamptz` | 小时区间的结束时间，统一使用 UTC。 |
| `load_mw` | `double precision` | 该区域的估算平均负荷，单位为 MW，不能小于 0。 |
| `temperature_2m_c` | `double precision` | 区域加权的 2 米气温，单位为 °C。 |
| `relative_humidity_2m_pct` | `double precision` | 区域加权的 2 米相对湿度，范围为 0–100%。 |
| `precipitation_mm` | `double precision` | 区域加权的前一小时降水深度，单位为 mm，不能小于 0。 |
| `wind_speed_10m_kmh` | `double precision` | 区域加权的 10 米风速，单位为 km/h，不能小于 0。 |

两张表的主键都是 `(zone, interval_end_utc)`，因此同一区域、同一时点只能有一行。时间已从 PJM 的历史本地 HE 标签转换为唯一 UTC 时点，夏令时回拨不会产生重复主键。

初始导入范围如下。回放开始后，`energy_hourly` 会持续增长，`energy_hourly_future` 保持不变。

| 表 | 区域 | 初始行数 | UTC 时间范围 |
| --- | --- | ---: | --- |
| `energy_hourly` | `AEP` | 98,588 | 2004-10-01 05:00:00Z 至 2015-12-31 23:00:00Z |
| `energy_hourly` | `DAYTON` | 98,590 | 2004-10-01 05:00:00Z 至 2015-12-31 23:00:00Z |
| `energy_hourly` | `DOM` | 93,504 | 2005-05-01 05:00:00Z 至 2015-12-31 23:00:00Z |
| `energy_hourly_future` | `AEP` | 22,685 | 2016-01-01 00:00:00Z 至 2018-08-03 04:00:00Z |
| `energy_hourly_future` | `DAYTON` | 22,685 | 2016-01-01 00:00:00Z 至 2018-08-03 04:00:00Z |
| `energy_hourly_future` | `DOM` | 22,685 | 2016-01-01 00:00:00Z 至 2018-08-03 04:00:00Z |

### `pred_static`

保存初始模型在固定留出集上的历史回测结果。它不参与生产预测，也不会被后续模型覆盖。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `zone` | `text` | 负荷区域。 |
| `forecast_origin_utc` | `timestamptz` | 当次预测使用数据的截止时间。 |
| `interval_end_utc` | `timestamptz` | 被预测小时的结束时间。 |
| `forecast_horizon_hour` | `smallint` | 预测时距，范围为 1–24；`1` 表示预测下一小时。 |
| `actual_load_mw` | `double precision` | 留出集中该时点的真实负荷，单位为 MW。 |
| `predicted_load_mw` | `double precision` | 初始静态模型给出的预测负荷，单位为 MW。 |

主键是 `(zone, forecast_origin_utc, interval_end_utc)`。

### `pred_dynamic`

字段、约束和主键与 `pred_static` 相同。保存**持续学习（动态）模型**的回测结果：随着回放推进，模型用「已到达数据」逐日重跑日前预测并写入，与 `pred_static`（初始静态模型，冻结对照）形成双轨——用于展示持续学习带来的预测改进。

- 起点节奏与 `pred_static` 一致（纽约本地日的日前起点 × h1–24）。
- 回放为增量写入：截至 2026-08-29 15:00（UTC+8），已写入 13,104 行，起点覆盖 2016-01-01 至 2016-07-31，正继续向 2018-08 推进；未覆盖起点由前端读取 `pred_static` 兜底。
- 2026-08-29 起该表对 `anon` 开放只读（策略与 `pred_static` 同款），供 web 决策台在线读取。

### `simulation_state`

这张表只有一行，用于记录小时回放进度。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `stream_name` | `text` | 回放流名称，固定为 `energy_hourly`，也是主键。 |
| `last_released_interval_end_utc` | `timestamptz` | 最近一次成功复制到 `energy_hourly` 的数据时间。 |
| `last_cron_tick_utc` | `timestamptz`，可为空 | 最近一次已经处理的真实 Cron 小时；用于保证同一小时重复执行时不会多释放数据。 |
| `updated_at` | `timestamptz` | 回放状态最近更新时间。 |

初始的 `last_released_interval_end_utc` 是 `2015-12-31 23:00:00Z`。

## 训练记录

### `training_experiments`

一行代表 Agent 调用训练 Skill 发起的一次完整调参实验。所有训练实例共享相同的数据范围、模型结构和验证规则。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `uuid` | 实验唯一编号，也是主键。 |
| `idempotency_key` | `text` | 调用的唯一键；同一个定时任务重试时复用它，避免重复创建实验。 |
| `status` | `text` | 实验状态：`queued`、`running`、`selecting`、`finalizing`、`succeeded`、`failed` 或 `cancelled`。 |
| `model_spec_version` | `text` | 固定模型结构的版本，例如 `hgb-24h-v1`。 |
| `code_version` | `text` | 本次训练所用代码的版本或文件摘要，用于复现结果。 |
| `fixed_config` | `jsonb` | Agent 不能修改的设置，例如区域、特征、滞后窗口、预测长度、时区和随机种子。 |
| `training_start_utc` | `timestamptz` | 本次训练数据窗口的起始时间，包含该时点。 |
| `validation_start_utc` | `timestamptz` | 验证数据窗口的起始时间，包含该时点。 |
| `data_end_exclusive_utc` | `timestamptz` | 本次实验的数据结束边界，不包含该时点。 |
| `selection_metric` | `text` | 选择最佳实例的指标，固定为 `mean_zone_wape`，数值越小越好。 |
| `expected_trial_count` | `smallint` | 本次实验计划运行的参数组合数量。 |
| `winner_trial_id` | `uuid`，可为空 | 验证效果最好的训练实例；选出冠军前为空。 |
| `created_at` | `timestamptz` | 实验记录创建时间。 |
| `started_at` | `timestamptz`，可为空 | 实验真正开始运行的时间。 |
| `finished_at` | `timestamptz`，可为空 | 实验成功、失败或取消的结束时间。 |
| `error_message` | `text`，可为空 | 实验失败时的错误说明。 |

时间范围必须满足 `training_start_utc < validation_start_utc < data_end_exclusive_utc`。成功实验必须有 `winner_trial_id`，且该实例必须属于当前实验。

### `training_trials`

一行代表实验中的一个参数组合。模型类型和特征结构不在这里，因此 Agent 只能调整允许的数值参数。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `uuid` | 训练实例唯一编号，也是主键。 |
| `experiment_id` | `uuid` | 所属实验，对应 `training_experiments.id`。 |
| `trial_number` | `smallint` | 实例在当前实验中的顺序号，从 1 开始。 |
| `status` | `text` | 实例状态：`queued`、`running`、`succeeded`、`failed` 或 `cancelled`。 |
| `learning_rate` | `double precision` | 学习率，控制每轮对最终结果的影响，范围为 `(0, 1]`。 |
| `max_iter` | `integer` | 最大提升轮数，范围为 1–5000。 |
| `max_leaf_nodes` | `smallint` | 每棵树最多可以有多少个叶节点，范围为 2–255。 |
| `max_depth` | `smallint`，可为空 | 每棵树的最大深度，范围为 1–64；为空表示不单独限制深度。 |
| `min_samples_leaf` | `integer` | 一个叶节点至少包含多少条样本，范围为 1–10000。数值越大，模型通常越平滑。 |
| `l2_regularization` | `double precision` | L2 正则强度，用于抑制过拟合，范围为 0–1,000,000。 |
| `max_features` | `double precision` | 每次分裂最多考虑的特征比例，范围为 `(0, 1]`。 |
| `max_bins` | `smallint` | 连续特征离散成的最大区间数，范围为 2–255。 |
| `loss_curve` | `jsonb`，可为空 | 各区域随训练轮数变化的训练 loss 和验证 loss；训练成功后必须存在。 |
| `validation_metrics` | `jsonb`，可为空 | 整体、各区域、各预测时距以及基线模型的验证指标。 |
| `mean_zone_wape` | `double precision`，可为空 | 三个区域 WAPE 的平均值，是冠军选择的主要指标。 |
| `mean_zone_mae_mw` | `double precision`，可为空 | 三个区域 MAE 的平均值，单位为 MW，用于主要指标相同时排序。 |
| `error_message` | `text`，可为空 | 实例失败时的错误说明。 |
| `created_at` | `timestamptz` | 实例记录创建时间。 |
| `started_at` | `timestamptz`，可为空 | 实例开始训练的时间。 |
| `finished_at` | `timestamptz`，可为空 | 实例结束时间。 |

同一个实验中的 `trial_number` 不能重复。实例只有同时写入 loss、验证指标、WAPE 和 MAE 后，才能标记为 `succeeded`。

## 模型版本

### `model_versions`

一行代表一次成功实验最终发布的完整模型包。一个模型包包含 AEP、DAYTON、DOM 三个区域模型和一份模型说明文件。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `model_id` | `text` | 模型版本号，也是主键，例如 `model-20260829T010203Z`。 |
| `experiment_id` | `uuid` | 产生该模型的实验；一个实验最多发布一个模型版本。 |
| `winner_trial_id` | `uuid` | 该实验中胜出的训练实例。 |
| `status` | `text` | 模型状态：`ready`、`active` 或 `retired`。全库最多有一个 `active` 模型。 |
| `storage_bucket` | `text` | 模型所在存储桶，固定为 `energy-models`。 |
| `storage_path` | `text` | 模型包在存储桶中的路径，必须以 `model_id/` 开头。 |
| `sha256` | `text` | 模型包的 SHA-256 校验值，用于发现上传损坏或文件被替换。 |
| `size_bytes` | `bigint` | 模型包大小，单位为字节，不能超过 50 MB。 |
| `created_at` | `timestamptz` | 模型版本记录创建时间。 |
| `activated_at` | `timestamptz`，可为空 | 模型被设为当前生产版本的时间。 |
| `retired_at` | `timestamptz`，可为空 | 模型停止作为生产版本的时间。 |

模型状态通常按 `ready → active → retired` 变化。生产代码只读取 `active` 模型。

### `energy-models` 对象存储桶

`energy-models` 是私有存储桶，只允许可信服务访问。单个文件不能超过 50 MB，支持 Joblib、JSON、Gzip 和 Zip 等模型文件格式。模型文件使用不可变路径，例如：

```text
model-20260829T010203Z/model.tar.gz
```

## 生产预测

### `forecast_runs`

一行代表一次完整的每日预测。创建记录时即固定模型版本，避免预测过程中切换模型。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `id` | `uuid` | 预测任务唯一编号，也是主键。 |
| `forecast_origin_utc` | `timestamptz` | 预测起点，即本次预测可使用真实数据的最晚时间；同一时点只能有一个生产预测任务。 |
| `model_id` | `text` | 本次使用的模型版本，对应 `model_versions.model_id`。 |
| `status` | `text` | 任务状态：`queued`、`running`、`succeeded` 或 `failed`。 |
| `error_message` | `text`，可为空 | 任务失败时的错误说明。 |
| `created_at` | `timestamptz` | 任务记录创建时间。 |
| `started_at` | `timestamptz`，可为空 | 任务开始预测的时间。 |
| `finished_at` | `timestamptz`，可为空 | 任务结束时间。 |

一次成功任务应生成 72 条预测：3 个区域 × 未来 24 小时。

### `energy_forecasts`

保存 `forecast_runs` 产生的具体预测值。真实值不复制到这里；实际数据到达后，通过 `(zone, interval_end_utc)` 与 `energy_hourly` 关联。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `forecast_run_id` | `uuid` | 所属预测任务，对应 `forecast_runs.id`。 |
| `zone` | `text` | 被预测的负荷区域。 |
| `forecast_horizon_hour` | `smallint` | 预测时距，范围为 1–24。 |
| `interval_end_utc` | `timestamptz` | 被预测小时的结束时间。 |
| `predicted_load_mw` | `double precision` | 预测负荷，单位为 MW，必须是有限的非负数。 |
| `created_at` | `timestamptz` | 预测结果写入时间。 |

主键是 `(forecast_run_id, zone, forecast_horizon_hour)`；同一任务、区域和目标时间也不能重复。预测起点和模型版本可通过 `forecast_run_id` 从 `forecast_runs` 获得。

## 权限与数据限制

- 所有表均已启用行级安全（RLS）。数据与回测表（`energy_hourly`、`energy_hourly_future`、`energy_daily`、`pred_static`、`pred_dynamic`、`model_versions`、`training_trials`）对 `anon` 开放**只读**策略，供 web 决策台在线读取；流程控制表（`simulation_state`、`forecast_runs`、`energy_forecasts`、`training_experiments`）仅限 `service_role`。
- `SUPABASE_SERVICE_ROLE_KEY` 只能保存在服务端环境变量中，不能写入模型文件、训练指标、日志或客户端代码。
- `load_mw` 是平均功率，不是直接存储的电量；对一小时区间可近似换算为 MWh。
- 天气数据来自 ERA5 再分析数据，是区域天气代理，不是单一气象站的实时实测值。
- 所有数据库时间使用 UTC；每日预测的业务时点按 `America/New_York` 解释。

## 数据来源

- [PJM / Kaggle Hourly Energy Consumption](https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption)
- [Open-Meteo Historical Weather API（ERA5）](https://open-meteo.com/en/docs/historical-weather-api)
