// Register only the Chart.js pieces the app draws (bar charts with an
// annotation line, and bar-and-line matchup charts), so the bundle omits every
// other chart type. Each chart module imports this file, so registration does
// not depend on load order.
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Legend,
  Tooltip,
  annotationPlugin,
);
