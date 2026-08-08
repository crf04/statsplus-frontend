import AssistChart from './AssistChart';

const ASSIST_TYPES = ['ThreePtAssists', 'TwoPtAssists'];

const TwoThreeAssistChart = (props) => (
  <AssistChart
    {...props}
    assistTypes={ASSIST_TYPES}
    labelFormatter={(type) => type.replace('Assists', '')}
  />
);

export default TwoThreeAssistChart;
