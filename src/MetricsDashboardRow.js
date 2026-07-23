import React from 'react';
import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';

const MetricCard = ({ title, currentValue, previousValue, change, isFirst, isLast }) => {
  const isPositive = change >= 0;
  const formattedChange = Math.abs(change).toFixed(2);
  
  return (
    <div className={`bg-[#16130d] p-4 flex-1 border-t border-b border-[#ffffff14] ${isFirst ? 'border-l rounded-l-lg' : 'border-l'} ${isLast ? 'border-r rounded-r-lg' : ''} ${!isLast ? 'border-r' : ''} relative hover:border-[#e8a33d] transition-all duration-300`}>
      <div className={`absolute top-2 right-2 flex items-center ${isPositive ? 'text-[#4caf7d]' : 'text-[#c24e4e]'}`}>
        {isPositive ? (
          <ArrowUpIcon className="w-4 h-4 mr-1" />
        ) : (
          <ArrowDownIcon className="w-4 h-4 mr-1" />
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-[#22301c] text-[#9cc983]' : 'bg-[#3a2020] text-[#e08585]'}`}>
          {formattedChange}%
        </span>
      </div>
      <h3 className="text-[#9b937f] font-medium mb-2 text-left uppercase text-xs tracking-wider">{title}</h3>
      <div className="flex items-baseline">
        <span className="text-2xl font-bold text-[#e8a33d] font-mono tabular-nums mr-2">{currentValue}</span>
        <span className="text-sm text-[#9b937f]">from {previousValue}</span>
      </div>
    </div>
  );
};

const RatioCard = ({ title, ratio, last5ratio, last10ratio, isLast }) => {
  if (!ratio) return null;
  const [numerator, denominator] = ratio.split('/');
  const percentage = ((parseInt(numerator) / parseInt(denominator)) * 100).toFixed(2);

  return (
    <div className={`bg-[#16130d] p-4 flex-1 border-t border-b border-l border-[#ffffff14] ${isLast ? 'border-r rounded-r-lg' : 'border-r'} relative hover:border-[#e8a33d] transition-all duration-300`}>
      <div className="absolute top-2 right-2 text-sm text-[#9b937f]">
        ({percentage}%)
      </div>
      <h3 className="text-[#9b937f] font-medium mb-2 text-left uppercase text-xs tracking-wider">{title}</h3>
      <div className="flex items-baseline">
        <div className="text-2xl font-bold text-[#e8a33d] font-mono tabular-nums">{ratio}</div>
        <span className="text-sm text-[#9b937f]"> &nbsp;L{last5ratio} </span>
        <span className="text-sm text-[#9b937f]"> &nbsp;L{last10ratio} </span>
      </div>
    </div>
  );
};

const MetricsDashboardRow = ({ rawValue, per36Value, seasonRawValue, seasonPer36Value, ratio, last5ratio, last10ratio}) => {
    const rawChange = ((rawValue - seasonRawValue) / seasonRawValue) * 100;
    const per36Change = ((per36Value - seasonPer36Value) / seasonPer36Value) * 100;
  
    return (
        <div style={{display: 'flex', flexDirection: 'row'}} className="rounded-lg overflow-hidden bg-[#16130d]">
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
          isFirst={false}
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