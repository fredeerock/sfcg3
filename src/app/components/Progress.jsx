'use client'

export default function Progress({ text, percentage = 0, total = '', isOverall = false }) {
  // Make sure we're working with a proper number
  const rawPercentage = parseFloat(percentage);
  const safePercentage = isNaN(rawPercentage) ? 0 : 
    Math.min(Math.max(rawPercentage, 0), 100);

  // Since we only show the overall progress now, make it slightly larger
  const barHeight = "h-5";
  const barColor = "bg-blue-600";
  const textSize = "text-sm";

  return (
    <div className="w-full bg-gray-200 rounded-full mb-2">
      <div 
        className={`${barColor} ${barHeight} rounded-full transition-all duration-300`}
        style={{ width: `${safePercentage}%` }}
        data-value={safePercentage}
      ></div>
      <div className={`${textSize} text-gray-700 dark:text-gray-300 flex justify-between mt-1`}>
        <span>{text}</span>
        <span>{safePercentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}
