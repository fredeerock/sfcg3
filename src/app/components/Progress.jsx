'use client'

export default function Progress({ text, percentage = 0 }) {
  const safePercentage = Math.min(Math.max(parseFloat(percentage) || 0, 0), 100);

  return (
    <div className="w-full bg-gray-200 rounded-full mb-2">
      <div 
        className="bg-blue-600 h-5 rounded-full transition-all duration-300"
        style={{ width: `${safePercentage}%` }}
      ></div>
      <div className="text-sm text-gray-700 dark:text-gray-300 flex justify-between mt-1">
        <span>{text}</span>
        <span>{safePercentage.toFixed(1)}%</span>
      </div>
    </div>
  );
}
