# NBA Game Logs Frontend - Claude Context

## Project Overview
This is a React-based frontend application for NBA game logs analysis and visualization. The application provides interactive filtering, natural language querying, and comprehensive data visualization for NBA player statistics and game data.

## Technology Stack
- **Framework**: React 18.3.1 (Create React App)
- **Styling**: 
  - Tailwind CSS 3.4.5
  - Bootstrap 5.3.3
  - React Bootstrap 2.10.2
  - Custom CSS
- **Charts & Visualization**: 
  - Chart.js 4.4.3
  - React Chart.js 2
  - Recharts 2.12.7
  - Chart.js plugins (annotation, datalabels)
- **UI Components**:
  - React Select 5.8.0
  - React Slider 2.0.6
  - React Bootstrap Range Slider 3.0.8
  - Lucide React 0.408.0 (icons)
- **Data & HTTP**: Axios 1.7.2
- **Routing**: React Router DOM 6.23.1
- **Utilities**: Lodash 4.17.21

## Key Components

### Core Components
- `App.js` - Main application entry point
- `GameLogFilter.js` - Primary filtering interface
- `HomePage.js` - Landing page component
- `GameLogsTable.js` - Data table display
- `NaturalLanguageQuery.js` - Natural language search interface

### Player Analysis
- `PlayerProfile.js` - Individual player statistics
- `PlayerSelector.js` - Player selection interface
- `PlayerStatsCards.js` - Statistical summary cards
- `PerformanceAverages.js` - Performance metrics

### Data Visualization
- `ChartComponent.js` - Generic chart wrapper
- `AssistProfileChart.js` - Assist-specific visualizations
- `PlaystyleComparisonChart.js` - Player comparison charts
- `TwoThreeAssistChart.js` - Specialized assist charts
- `OpposingTeamProfile.js` - Opposition analysis

### Filtering & Search
- `FilterOptions.js` - Filter configuration
- `AppliedFilters.js` - Active filter display
- `ModernSearch.css` - Search styling
- `GameLogFilter.css` - Filter styling
- `PlayerSelector.css` - Player selection styling
- `PlayerStatsCards.css` - Stats card styling

### Dashboard & Metrics
- `MetricsDashboardRow.js` - Dashboard row component
- `ArchetypeGameLogs.js` - Player archetype analysis

## Development Commands

### Start Development Server
```bash
npm start
```
Runs on http://localhost:3000 with hot reloading.

### Build for Production
```bash
npm run build
```
Creates optimized production build in `build/` folder.

### Run Tests
```bash
npm test
```
Launches test runner in interactive watch mode.

### Linting & Code Quality
The project uses ESLint with React app configuration. Run linting through:
```bash
npm run build
```
(Build process includes linting)

## Project Structure
```
src/
├── App.js                      # Main app component
├── App.css                     # App-specific styles
├── index.js                    # React DOM entry point
├── index.css                   # Global styles
├── [Component].js              # React components
├── [Component].css             # Component-specific styles
└── utils.js                    # Utility functions

public/
├── index.html                  # HTML template
├── favicon.ico                 # Site icon
├── manifest.json               # PWA manifest
└── robots.txt                  # SEO robots file
```

## API Integration
The frontend communicates with a Flask/Python backend API using Axios for HTTP requests. The backend provides:
- Player statistics and game logs
- Natural language query processing
- Data filtering and aggregation
- Real-time data updates

## Styling Architecture
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Bootstrap**: Component library for consistent UI elements
- **Custom CSS**: Component-specific styling and overrides
- **Responsive Design**: Mobile-first approach with responsive breakpoints

## Key Features
1. **Interactive Filtering**: Multi-dimensional filtering of NBA game data
2. **Natural Language Queries**: AI-powered search using plain English
3. **Data Visualization**: Multiple chart types for statistical analysis
4. **Player Profiles**: Detailed individual player analysis
5. **Performance Metrics**: Comprehensive statistical dashboards
6. **Responsive Design**: Works across desktop, tablet, and mobile devices

## Testing
- **Framework**: Jest (via Create React App)
- **React Testing**: @testing-library/react
- **User Interaction**: @testing-library/user-event
- **DOM Testing**: @testing-library/jest-dom

## Browser Support
- Production: >0.2% usage, not dead browsers, not Opera Mini
- Development: Latest Chrome, Firefox, and Safari

## Performance Considerations
- Code splitting available through React.lazy()
- Bundle analysis tools integrated
- Production builds are minified and optimized
- Progressive Web App capabilities configured

## Development Notes
- Uses functional components with React Hooks
- Follows React best practices and conventions
- ESLint configuration enforces code quality
- Hot reloading enabled for development efficiency
- Source maps available for debugging