import AssistChart from './AssistChart';

const ASSIST_TYPES = [
  'Arc3Assists',
  'Corner3Assists',
  'AtRimAssists',
  'ShortMidRangeAssists',
  'LongMidRangeAssists',
];

const AssistProfileChart = (props) => (
  <AssistChart
    {...props}
    assistTypes={ASSIST_TYPES}
    labelFormatter={(type) => type.replace('Assists', '').replace('MidRange', 'MR')}
  />
);

export default AssistProfileChart;
