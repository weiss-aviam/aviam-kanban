#!/bin/bash

# Deployment Status Check Script

echo "📊 Aviam Kanban - Deployment Status"
echo "===================================="
echo ""

# Check PM2 status
echo "🔧 PM2 Process Status:"
pm2 describe kanban-app 2>/dev/null || echo "   ⚠️  PM2 process not running"
echo ""

# Check if app is responding
echo "🌐 Application Health:"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8777 | grep -q "200\|301\|302"; then
    echo "   ✅ Application is responding on port 8777"
else
    echo "   ❌ Application is not responding on port 8777"
fi
echo ""

# Check migration status
echo "📦 Database Migrations:"
if [ -f ".migrations-applied.json" ]; then
    MIGRATION_COUNT=$(cat .migrations-applied.json | grep -o '"' | wc -l)
    echo "   ✅ Migration tracker found"
    cat .migrations-applied.json | head -20
else
    echo "   ℹ️  No migrations applied yet"
fi
echo ""

# Check recent logs
echo "📝 Recent Logs (last 10 lines):"
pm2 logs kanban-app --nostream --lines 10 2>/dev/null || echo "   ⚠️  No logs available"
echo ""

echo "===================================="
echo "💡 Tip: Run 'pm2 logs kanban-app' for live logs"

