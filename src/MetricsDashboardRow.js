import { ArrowUpIcon, ArrowDownIcon } from 'lucide-react';
import { formatNumber, toFiniteNumber } from './numberUtils';

const MetricCard = ({ title, currentValue, previousValue, change, isFirst, isLast }) => {
  const changeNumber = toFiniteNumber(change);
  const isPositive = changeNumber !== null && changeNumber >= 0;
  const formattedChange = changeNumber === null ? '—' : formatNumber(Math.abs(changeNumber), 2);

  return (
    <div
      className={`bg-[#16130d] p-4 flex-1 border-t border-b border-[#ffffff14] ${isFirst ? 'border-l rounded-l-lg' : 'border-l'} ${isLast ? 'border-r rounded-r-lg' : ''} ${!isLast ? 'border-r' : ''} relative hover:border-[#e8a33d] transition-all duration-300`}
    >
      <div
        className={`absolute top-2 right-2 flex items-center ${isPositive ? 'text-[#4caf7d]' : 'text-[#c24e4e]'}`}
      >
        {isPositive ? (
          <ArrowUpIcon className="w-4 h-4 mr-1" />
        ) : (
          <ArrowDownIcon className="w-4 h-4 mr-1" />
        )}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${isPositive ? 'bg-[#22301c] text-[#9cc983]' : 'bg-[#3a2020] text-[#e08585]'}`}
        >
          {formattedChange}%
        </span>
      </div>
      <h3 className="text-[#9b937f] font-medium mb-2 text-left uppercase text-xs tracking-wider">
        {title}
      </h3>
      <div className="flex items-baseline">
        <span className="text-2xl font-bold text-[#e8a33d] font-mono tabular-nums mr-2">
          {currentValue}
        </span>
        <span className="text-sm text-[#9b937f]">from {previousValue}</span>
      </div>
    </div>
  );
};

const RatioCard = ({ title, ratio, last5ratio, last10ratio, isLast }) => {
  if (!ratio) return null;
  const [numerator, denominator] = String(ratio).split('/');
  const numeratorValue = toFiniteNumber(numerator);
  const denominatorValue = toFiniteNumber(denominator);
  const percentage =
    denominatorValue && numeratorValue !== null
      ? formatNumber((numeratorValue / denominatorValue) * 100, 2)
      : '—';

  return (
    <div
      className={`bg-[#16130d] p-4 flex-1 border-t border-b border-l border-[#ffffff14] ${isLast ? 'border-r rounded-r-lg' : 'border-r'} relative hover:border-[#e8a33d] transition-all duration-300`}
    >
      <div className="absolute top-2 right-2 text-sm text-[#9b937f]">({percentage}%)</div>
      <h3 className="text-[#9b937f] font-medium mb-2 text-left uppercase text-xs tracking-wider">
        {title}
      </h3>
      <div className="flex items-baseline">
        <div className="text-2xl font-bold text-[#e8a33d] font-mono tabular-nums">{ratio}</div>
        <span className="text-sm text-[#9b937f]"> &nbsp;L{last5ratio || '—'} </span>
        <span className="text-sm text-[#9b937f]"> &nbsp;L{last10ratio || '—'} </span>
      </div>
    </div>
  );
};

const MetricsDashboardRow = ({
  rawValue,
  per36Value,
  seasonRawValue,
  seasonPer36Value,
  ratio,
  last5ratio,
  last10ratio,
}) => {
  const currentRaw = toFiniteNumber(rawValue, 0);
  const previousRaw = toFiniteNumber(seasonRawValue, 0);
  const currentPer36 = toFiniteNumber(per36Value, 0);
  const previousPer36 = toFiniteNumber(seasonPer36Value, 0);
  const getChange = (current, previous) => {
    if (previous === 0) return current === 0 ? 0 : null;
    return ((current - previous) / previous) * 100;
  };
  const rawChange = getChange(currentRaw, previousRaw);
  const per36Change = getChange(currentPer36, previousPer36);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'row' }}
      className="rounded-lg overflow-hidden bg-[#16130d]"
    >
      <MetricCard
        title="Raw"
        currentValue={formatNumber(currentRaw, 2)}
        previousValue={formatNumber(previousRaw, 2)}
        change={rawChange}
        isFirst={true}
      />
      <MetricCard
        title="Per-36"
        currentValue={formatNumber(currentPer36, 2)}
        previousValue={formatNumber(previousPer36, 2)}
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
