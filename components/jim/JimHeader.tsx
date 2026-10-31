interface JimHeaderProps {
  onSignOut: () => void;
}

/** Title bar for the signed-in screens; clears the notch. */
export default function JimHeader({ onSignOut }: JimHeaderProps) {
  return (
    <header className="shrink-0 border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex h-14 w-full max-w-[45rem] items-center justify-between gap-4 px-4">
        <h1 className="text-lg font-semibold">Jim</h1>
        <button
          type="button"
          onClick={onSignOut}
          className="-mr-2 min-h-11 rounded-md px-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
