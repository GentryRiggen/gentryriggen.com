export default function WebGLFallback() {
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-2">
        <p className="text-lg font-semibold">3D isn&apos;t available here</p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your browser doesn&apos;t support WebGL, so the shipyard can&apos;t
          draw your liner. Try a recent version of Chrome, Firefox or Safari.
        </p>
      </div>
    </div>
  );
}
