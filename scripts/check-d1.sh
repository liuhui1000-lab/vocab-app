#!/bin/bash

# D1 数据库初始化检查脚本
# 使用方法: ./scripts/check-d1.sh

echo "=========================================="
echo "Cloudflare D1 数据库检查"
echo "=========================================="

# 检查表是否存在
echo ""
echo "📋 检查表结构..."
echo "------------------------------------------"
wrangler d1 execute vocab-app-db --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# 检查用户表
echo ""
echo "👤 检查用户表..."
echo "------------------------------------------"
wrangler d1 execute vocab-app-db --remote --command="SELECT id, username, is_admin FROM users;"

# 检查学期分类
echo ""
echo "📚 检查学期分类..."
echo "------------------------------------------"
wrangler d1 execute vocab-app-db --remote --command="SELECT id, name, slug, \"order\" FROM semesters ORDER BY \"order\";"

# 检查单词数量
echo ""
echo "📝 检查单词数量..."
echo "------------------------------------------"
wrangler d1 execute vocab-app-db --remote --command="SELECT COUNT(*) as total_words FROM vocab_words;"

# 检查进度数量
echo ""
echo "📊 检查学习进度..."
echo "------------------------------------------"
wrangler d1 execute vocab-app-db --remote --command="SELECT COUNT(*) as total_progress FROM user_progress;"

# 检查统计数量
echo ""
echo "📈 检查学习统计..."
echo "------------------------------------------"
wrangler d1 execute vocab-app-db --remote --command="SELECT COUNT(*) as total_stats FROM study_stats;"

echo ""
echo "=========================================="
echo "✅ 检查完成"
echo "=========================================="
