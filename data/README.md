# `energy_hourly` 数据表

`public.energy_hourly` 是 Supabase 中的统一小时负荷表。每一行表示一个 PJM 负荷区域在一个实际小时结束时的负荷，以及对应的区域天气特征。

- 总行数：358,737
- 区域：`AEP`、`DAYTON`、`DOM`
- 行级安全（RLS）：已启用

## 数据范围

| 区域 | 行数 | UTC 时间范围 |
| --- | ---: | --- |
| `AEP` | 121,273 | 2004-10-01 05:00:00Z 至 2018-08-03 04:00:00Z |
| `DAYTON` | 121,275 | 2004-10-01 05:00:00Z 至 2018-08-03 04:00:00Z |
| `DOM` | 116,189 | 2005-05-01 05:00:00Z 至 2018-08-03 04:00:00Z |

这些区域是 PJM 的负荷区，不代表单一城市、变电站或客户。

## 字段

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `zone` | `text` | 负荷区域：`AEP`、`DAYTON` 或 `DOM`。 |
| `interval_end_utc` | `timestamptz` | 小时区间结束时点，统一使用 UTC。 |
| `load_mw` | `double precision` | 该区域的估算小时负荷，单位为 MW。 |
| `temperature_2m_c` | `double precision` | 区域加权的 2 米气温，单位为 °C。 |
| `relative_humidity_2m_pct` | `double precision` | 区域加权的 2 米相对湿度，单位为 %。 |
| `precipitation_mm` | `double precision` | 区域加权的前一小时降水深度，单位为 mm。 |
| `wind_speed_10m_kmh` | `double precision` | 区域加权的 10 米风速，单位为 km/h。 |

主键是 `(zone, interval_end_utc)`。时间已从 PJM 的历史本地 HE 标签转换为唯一 UTC 时点，因此夏令时回拨不会产生重复主键。

## 使用与限制

- `load_mw` 是估算的平均功率，不是直接存储的电量；在一小时区间内可近似换算为 MWh。
- 天气数据来自 ERA5 再分析数据，是区域天气代理，不是单一站点的实测值。
- 表已启用 RLS；应用访问前需要按实际权限配置相应策略。

## 来源

- [PJM / Kaggle Hourly Energy Consumption](https://www.kaggle.com/datasets/robikscube/hourly-energy-consumption)
- [Open-Meteo Historical Weather API（ERA5）](https://open-meteo.com/en/docs/historical-weather-api)
