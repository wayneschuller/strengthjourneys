# Bundle Size Optimization

## Changes Made

### 1. ✅ Dynamic Import for html2canvas
- `html2canvas` (~200KB) now loads only when user clicks the share button in the heatmap card
- Previously loaded on every analyzer page visit
- **Impact**: Saves ~200KB from initial bundle for analyzer page

**Location**: `src/components/analyzer/heatmap-card.js`
- The import is now done dynamically inside `handleShare` function

### 2. ✅ Removed Unused Dependency
- Removed `react-chartjs-2` from dependencies
- This package was unused (the project uses `recharts` instead)
- **Impact**: Reduces node_modules size and eliminates unused code
