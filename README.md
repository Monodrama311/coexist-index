# 共处 · Coexist v1

## 文件结构

```
coexist/
├── index.html              # 入口
├── quiz.html               # 25 题答题
├── result.html             # 结果卡 + 实时数字
├── collection.html         # 卡册
├── schema.sql              # Supabase 数据库
├── admin/
│   └── index.html          # 后台仪表盘(密码保护)
└── assets/
    ├── css/
    │   ├── tokens.css      # 设计变量
    │   └── main.css        # 全部样式
    ├── js/
    │   ├── supabase-client.js
    │   ├── fingerprint.js  # 用户识别(无登录)
    │   ├── quiz-engine.js  # 答题引擎
    │   ├── hidden-cards.js # 隐藏卡触发
    │   ├── result-engine.js # 评分 + 结果
    │   └── share-card.js   # 分享卡导出
    ├── data/
    │   ├── questions.json  # 25 题(文案待填)
    │   └── cards.json      # 21+14 张卡
    └── images/
```

## 部署步骤

### 1. Supabase
1. supabase.com 创建 project
2. SQL Editor 跑 `schema.sql`
3. 复制 Project URL 和 anon key

### 2. 配置前端
编辑 `assets/js/supabase-client.js`:
```js
const SUPABASE_URL = 'https://xxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJxxx...';
```

### 3. Admin 密码
编辑 `admin/index.html`:
```js
const ADMIN_PASS = '你的密码';
```

### 4. GitHub Pages
```bash
git init
git add .
git commit -m "v1"
git remote add origin https://github.com/Monodrama311/coexist-index.git
git push -u origin main
```
GitHub repo Settings → Pages → main → save

### 5. CNAME
```
echo "test.dmlogic.ca" > CNAME
git add CNAME && git commit -m "cname" && git push
```
DNS: CNAME `test` → `monodrama311.github.io`

## 当前状态

- ✅ 数据库 schema(5 表 + 4 函数 + RLS)
- ✅ 前端骨架(入口/答题/结果/卡册/admin)
- ✅ 多选 + 实时数字 + 隐藏卡触发 + 个性签名 + 卡册收集
- ✅ 五派分配 + 35 张卡数据(锚卡文案已填,其余占位)
- ⚠️ 25 题题面为骨架文案,需要真写手填充
- ⚠️ 17 张主卡文案待填(4 张 anchor + COEX 已填)

## 可不接 Supabase 直接预览
Supabase 未配置时进入 mock 模式,所有功能仍可演示。
