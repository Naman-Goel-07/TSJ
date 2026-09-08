/** Placeholder pages for routes not yet built */

export function Submit() {
  return (
    <div className="min-h-screen bg-recess flex items-center justify-center">
      <p className="text-chalk">Submit — coming in step 5</p>
    </div>
  )
}

export function Admin() {
  return (
    <div className="min-h-screen bg-recess flex items-center justify-center">
      <p className="text-chalk">Admin — coming in step 8</p>
    </div>
  )
}

/** Every route now has a real page. This file holds the 404 and nothing else. */

export function NotFound() {
  return (
    <div className="min-h-screen bg-recess flex items-center justify-center p-gutter">
      <div className="text-center">
        <div className="w-16 h-10 bg-enamel border border-seam rounded-slot shadow-slot shadow-lip mx-auto mb-4" />
        <p className="text-chalk font-medium">Nothing posted here.</p>
        <p className="text-sm text-chalk/60 mt-1">That address does not match a page.</p>
        <a
          href="/"
          className="text-sm text-lamp underline mt-4 inline-block focus:outline-none focus:shadow-ring rounded-slot px-1"
        >
          Back to the board
        </a>
      </div>
    </div>
  )
}

