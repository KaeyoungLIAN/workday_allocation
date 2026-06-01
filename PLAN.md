# 排班分配器 重构计划

## 1. 预设填满岗位的职员

- `config.js` 新增 `getDefaultWorkers(positions)`：根据岗位配置自动生成虚拟职员
  - 每个岗位按 maxStaff 生成足量人员
  - 命名如"大堂1""大堂2""现金柜员1""普通柜员1"……
  - 每人仅分配一个岗位，优先级 1（最高）
  - 休息日全部为空（周一~周五可用，周六固定休息）
- `App.jsx` 中 `loadWorkers()` 返回空数组时自动调用 `getDefaultWorkers(loadPositions())`
  - 同时写入 localStorage，跟岗位一样的模式

## 2. 岗位日历常态化显示
- 删除 `showWarnings` 状态
- `ScheduleView` 始终渲染日历格子（包括每个岗位的 `assigned.length/pos.minStaff`）
- 但点击「随机生成排班」前，所有格子里显示「—待分配—」（或灰色占位）
- 警告仅在点击按钮后出现（现有逻辑可复用，改为 `warnings` 为空时不显示面板即可）

## 3. 每日优先级设置

### 数据模型
```
positions 存储不变，仍为 [{ id, name, minStaff, maxStaff }]
```
新增 localStorage key `wd_pos_priorities`：
```json
{
  "pos_dt": [1, 1, 1, 1, 1, 0, 2],  // 周一~周日，0=不需要/休息
  "pos_xj": [2, 2, 2, 2, 2, 0, 2],
  ...
}
```

### 默认值生成
- 首次使用时，根据职位 id 生成默认优先级向量
- 大堂 1，现金 2，普通 3，授权 0/2（周中0周末2）
- 自定义岗位：一律 9，周日也用 9
- 周六（index5）固定 0

### 用户编辑 UI
- 岗位 tab 下面增加优先级编辑区
- 用网格编辑：每行一个岗位，每列一天（周一~周日，但周六不可编辑）
- 每个格子是一个数字输入（或 +/- 按钮）
- 同样通过 useRef + scrollIntoView 定位

### algorithm 适配
- `scheduler.js` 的 `getGlobalPriority` 改为从 `wd_pos_priorities` 读取
- 周六 skip 逻辑不变（needPosOnDay）

## 4. 删除恢复默认按钮
PositionsView 中 remove `handleReset` 及相关按钮 JSX。

## 5. 导出/导入兼容
导出/导入当前只处理人员数据，优先级数据在 localStorage 中不会随导出移动。
先保持现状，之后可再议。
