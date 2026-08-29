import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 命令式引擎为单次挂载语义（boot 只跑一次）；双挂载会导致二次图表初始化 */
  reactStrictMode: false,
};

export default nextConfig;
