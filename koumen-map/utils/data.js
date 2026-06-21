/** 武汉大学周边种子数据（可替换为你所在城市） */
const SEED_SHOPS = [
  {
    id: 'seed-1',
    name: '老张兰州拉面',
    category: '面',
    latitude: 30.5368,
    longitude: 114.3642,
    address: '珞喻路129号',
    tags: ['无限续面', '学生友好'],
    items: [
      { name: '牛肉拉面', price: 12, verifiedCount: 5 },
      { name: '加蛋', price: 2, verifiedCount: 3 },
      { name: '加牛肉', price: 5, verifiedCount: 2 },
    ],
    tips: '中午饭点要排队，建议11:30前去',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-2',
    name: '黄焖鸡米饭（广八路店）',
    category: '饭',
    latitude: 30.5355,
    longitude: 114.3628,
    address: '广八路88号',
    tags: ['可拼饭', '免费汤'],
    items: [
      { name: '小份黄焖鸡', price: 15, verifiedCount: 8 },
      { name: '大份黄焖鸡', price: 18, verifiedCount: 6 },
      { name: '加米饭', price: 2, verifiedCount: 4 },
    ],
    tips: '小份够女生吃，男生建议大份',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-3',
    name: '桂林米粉',
    category: '粉',
    latitude: 30.5372,
    longitude: 114.3655,
    address: '珞珈山路15号',
    tags: ['学生友好'],
    items: [
      { name: '素粉', price: 8, verifiedCount: 4 },
      { name: '肉丝粉', price: 12, verifiedCount: 7 },
      { name: '锅烧粉', price: 14, verifiedCount: 5 },
    ],
    tips: '素粉8块真的划算',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-4',
    name: '沙县小吃（武大店）',
    category: '快餐',
    latitude: 30.5348,
    longitude: 114.3635,
    address: '珞喻路152号',
    tags: ['无限续饭'],
    items: [
      { name: '拌面', price: 7, verifiedCount: 10 },
      { name: '扁肉', price: 8, verifiedCount: 9 },
      { name: '炖罐', price: 10, verifiedCount: 6 },
      { name: '鸡腿饭', price: 13, verifiedCount: 8 },
    ],
    tips: '拌面+扁肉组合15块吃饱',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-5',
    name: '东北饺子馆',
    category: '面',
    latitude: 30.5380,
    longitude: 114.3610,
    address: '广八路120号',
    tags: ['可拼饭'],
    items: [
      { name: '猪肉白菜饺子(12个)', price: 10, verifiedCount: 6 },
      { name: '酸汤饺子', price: 12, verifiedCount: 4 },
      { name: '小米粥', price: 3, verifiedCount: 3 },
    ],
    tips: '12个饺子女生够吃',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-6',
    name: '隆江猪脚饭',
    category: '饭',
    latitude: 30.5360,
    longitude: 114.3668,
    address: '珞珈山路28号',
    tags: ['免费汤'],
    items: [
      { name: '标准猪脚饭', price: 16, verifiedCount: 5 },
      { name: '双拼饭', price: 18, verifiedCount: 3 },
      { name: '加卤蛋', price: 2, verifiedCount: 2 },
    ],
    tips: '标准份肉给很多',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-7',
    name: '重庆小面',
    category: '面',
    latitude: 30.5342,
    longitude: 114.3648,
    address: '广八路66号',
    tags: ['学生友好'],
    items: [
      { name: '小面', price: 9, verifiedCount: 7 },
      { name: '豌杂面', price: 12, verifiedCount: 6 },
      { name: '加煎蛋', price: 2, verifiedCount: 4 },
    ],
    tips: '9块小面能吃饱，微辣刚好',
    source: 'seed',
    createdAt: '2025-06-01',
  },
  {
    id: 'seed-8',
    name: '武大枫园食堂',
    category: '食堂',
    latitude: 30.5395,
    longitude: 114.3620,
    address: '武汉大学枫园',
    tags: ['学生友好', '无限续饭'],
    items: [
      { name: '一荤一素', price: 10, verifiedCount: 12 },
      { name: '两荤一素', price: 13, verifiedCount: 10 },
      { name: '米饭', price: 0.5, verifiedCount: 8 },
    ],
    tips: '需要武大学生证或校园卡',
    source: 'seed',
    createdAt: '2025-06-01',
  },
];

const PRICE_FILTERS = [
  { key: 'all', label: '全部', max: Infinity },
  { key: '15', label: '≤15元', max: 15 },
  { key: '20', label: '≤20元', max: 20 },
  { key: '30', label: '≤30元', max: 30 },
];

const CATEGORIES = ['面', '饭', '粉', '快餐', '食堂', '其他'];

const TAGS = ['学生友好', '可拼饭', '免费汤', '无限续面', '无限续饭'];

function calcMinPrice(shop) {
  if (!shop.items || shop.items.length === 0) return 999;
  return Math.min(...shop.items.map((i) => i.price));
}

function calcFullMealPrice(shop) {
  if (!shop.items || shop.items.length === 0) return 999;
  const mains = shop.items.filter((i) => i.price >= 5);
  return mains.length > 0 ? Math.min(...mains.map((i) => i.price)) : calcMinPrice(shop);
}

function enrichShop(shop) {
  return {
    ...shop,
    minPrice: calcMinPrice(shop),
    fullMealPrice: calcFullMealPrice(shop),
  };
}

module.exports = {
  SEED_SHOPS,
  PRICE_FILTERS,
  CATEGORIES,
  TAGS,
  calcMinPrice,
  calcFullMealPrice,
  enrichShop,
};
