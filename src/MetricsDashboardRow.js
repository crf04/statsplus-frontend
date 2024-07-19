import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

const MetricCard = ({ title, currentValue, previousValue, change, isFirst, isLast }) => {
  const isPositive = change >= 0;
  const formattedChange = Math.abs(change).toFixed(2);
  
  return (
    <div className={`bg-white p-4 flex-1 border-t border-b ${isFirst ? 'border-l rounded-l-lg' : ''} ${isLast ? 'border-r rounded-r-lg' : ''} ${!isLast ? 'border-r' : ''} relative`}>
      <div className={`absolute top-2 right-2 flex items-center ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? (
          <ArrowUpIcon className="w-4 h-4 mr-1" />
        ) : (
          <ArrowDownIcon className="w-4 h-4 mr-1" />
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
          {formattedChange}%
        </span>
      </div>
      <h3 className="text-gray-700 font-medium mb-2 text-left">{title}</h3>
      <div className="flex items-baseline">
        <span className="text-2xl font-bold text-indigo-600 mr-2">{currentValue}</span>
        <span className="text-sm text-gray-500">from {previousValue}</span>
      </div>
    </div>
  );
};

const RatioCard = ({ title, ratio, last5ratio, last10ratio, isLast }) => {
  const [numerator, denominator] = ratio.split('/');
  const percentage = ((parseInt(numerator) / parseInt(denominator)) * 100).toFixed(2);

  return (
    <div className={`bg-white p-4 flex-1 border-t border-b ${isLast ? 'border-r rounded-r-lg' : 'border-r'} relative`}>
      <div className="absolute top-2 right-2 text-sm text-gray-500">
        ({percentage}%)
      </div>
      <h3 className="text-gray-700 font-medium mb-2 text-left">{title}</h3>
      <div className="flex items-baseline">
        <div className="text-2xl font-bold text-indigo-600">{ratio}</div>
        <span className="text-sm text-gray-500"> &nbsp;L{last5ratio} </span>
        <span className="text-sm text-gray-500"> &nbsp;L{last10ratio} </span>
      </div>
    </div>
  );
};

const MetricsDashboardRow = ({ rawValue, per36Value, seasonRawValue, seasonPer36Value, ratio, last5ratio, last10ratio}) => {
    const rawChange = ((rawValue - seasonRawValue) / seasonRawValue) * 100;
    const per36Change = ((per36Value - seasonPer36Value) / seasonPer36Value) * 100;
  
    return (
        <div style={{display: 'flex', flexDirection: 'row'}} className="shadow-md rounded-lg overflow-hidden">
        <MetricCard
          title="Raw"
          currentValue={rawValue.toFixed(2)}
          previousValue={seasonRawValue.toFixed(2)}
          change={rawChange}
          isFirst={true}
        />
        <MetricCard
          title="Per-36"
          currentValue={per36Value.toFixed(2)}
          previousValue={seasonPer36Value.toFixed(2)}
          change={per36Change}
        />
        <RatioCard
          title="Hit Rate"
          ratio={ratio}
          last5ratio={last5ratio}
          last10ratio={last10ratio}
          isLast={true}
        />
      </div>
    );
  };

export default MetricsDashboardRow;