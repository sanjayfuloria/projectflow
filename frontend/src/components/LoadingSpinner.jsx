// src/components/LoadingSpinner.jsx
export default function LoadingSpinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-10 h-10 border-4' : 'w-7 h-7 border-[3px]'
  return (
    <div className={`${s} rounded-full border-accent/30 border-t-accent animate-spin`} />
  )
}
