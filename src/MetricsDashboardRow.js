import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

const MetricCard = ({ title, currentValue, previousValue, change, isFirst, isLast }) => {
  const isPositive = change >= 0;
  const formattedChange = Math.abs(change).toFixed(2);
  
  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 p-4 flex-1 border-t border-b border-gray-600 ${isFirst ? 'border-l rounded-l-lg' : ''} ${isLast ? 'border-r rounded-r-lg' : ''} ${!isLast ? 'border-r' : ''} relative hover:border-yellow-500 transition-all duration-300`}>
      <div className={`absolute top-2 right-2 flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? (
          <ArrowUpIcon className="w-4 h-4 mr-1" />
        ) : (
          <ArrowDownIcon className="w-4 h-4 mr-1" />
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {formattedChange}%
        </span>
      </div>
      <h3 className="text-gray-300 font-medium mb-2 text-left uppercase text-xs tracking-wider">{title}</h3>
      <div className="flex items-baseline">
        <span className="text-2xl font-bold text-yellow-500 mr-2">{currentValue}</span>
        <span className="text-sm text-gray-400">from {previousValue}</span>
      </div>
    </div>
  );
};

const RatioCard = ({ title, ratio, last5ratio, last10ratio, isLast }) => {
  const [numerator, denominator] = ratio.split('/');
  const percentage = ((parseInt(numerator) / parseInt(denominator)) * 100).toFixed(2);

  return (
    <div className={`bg-gradient-to-br from-gray-800 to-gray-900 p-4 flex-1 border-t border-b border-gray-600 ${isLast ? 'border-r rounded-r-lg' : 'border-r'} relative hover:border-yellow-500 transition-all duration-300`}>
      <div className="absolute top-2 right-2 text-sm text-gray-400">
        ({percentage}%)
      </div>
      <h3 className="text-gray-300 font-medium mb-2 text-left uppercase text-xs tracking-wider">{title}</h3>
      <div className="flex items-baseline">
        <div className="text-2xl font-bold text-yellow-500">{ratio}</div>
        <span className="text-sm text-gray-400"> &nbsp;L{last5ratio} </span>
        <span className="text-sm text-gray-400"> &nbsp;L{last10ratio} </span>
      </div>
    </div>
  );
};

const MetricsDashboardRow = ({ rawValue, per36Value, seasonRawValue, seasonPer36Value, ratio, last5ratio, last10ratio}) => {
    const rawChange = ((rawValue - seasonRawValue) / seasonRawValue) * 100;
    const per36Change = ((per36Value - seasonPer36Value) / seasonPer36Value) * 100;
  
    return (
        <div style={{display: 'flex', flexDirection: 'row'}} className="shadow-xl rounded-lg overflow-hidden bg-gradient-to-r from-gray-800 to-gray-900">
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