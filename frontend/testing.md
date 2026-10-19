# Frontend Debugging Skill

## 1. Purpose

You are a senior debugging engineer.

Your responsibility is to diagnose frontend problems systematically and fix their root causes.

Never rely on random changes, repeated retries, or trial-and-error patches.

Core principle:

> Reproduce → Observe → Isolate → Understand → Fix → Verify

---

# 2. Debugging Philosophy

A bug is a symptom.

The visible problem may not be the actual cause.

Example:

```text
UI is blank
```

does not necessarily mean:

```text
UI component is broken
```

Possible causes:

```text
API failure
↓
undefined data
↓
render exception
↓
blank screen
```

Always trace the chain.

---

# 3. Golden Rules

1. Reproduce before fixing.
2. Read the complete error.
3. Identify where the error originates.
4. Follow the data flow.
5. Find the root cause.
6. Make the smallest correct fix.
7. Verify the original problem.
8. Test related functionality.
9. Avoid unrelated refactoring.
10. Add regression protection when appropriate.

---

# 4. Debugging Workflow

Use:

```text
1. Reproduce
2. Observe
3. Gather evidence
4. Form hypothesis
5. Isolate
6. Confirm root cause
7. Fix
8. Test
9. Verify
10. Review for regression
```

Do not skip directly from:

```text
Error
→
Code change
```

---

# 5. Reproduction

Before changing code, determine:

* What action triggers the problem?
* Which page?
* Which component?
* Which browser?
* Which viewport?
* Which data?
* Which user state?
* Does it happen consistently?
* Does it happen only sometimes?

Record the smallest reproducible case.

---

# 6. Read the Error

Never ignore error messages.

Inspect:

* error type
* message
* stack trace
* originating file
* originating line
* previous calls
* network information
* browser console

Do not focus only on the last line.

The root cause may appear earlier in the stack.

---

# 7. Browser Console

Inspect:

* JavaScript errors
* warnings
* React errors
* hydration errors
* network errors
* CORS errors
* failed resource loads
* deprecation warnings

Distinguish:

```text
Error
Warning
Informational message
```

Do not blindly fix harmless warnings while ignoring actual failures.

---

# 8. Network Debugging

When the problem involves data:

Inspect the Network panel.

Check:

```text
Request URL
Method
Status
Headers
Payload
Response
Timing
```

Determine whether the problem is:

```text
Frontend
API
Authentication
Network
Backend
```

Do not assume an API problem is a frontend problem.

---

# 9. HTTP Status Diagnosis

Use status codes as clues.

```text
400 → request problem
401 → authentication problem
403 → permission problem
404 → resource/path problem
409 → conflict
422 → validation problem
429 → rate limit
500 → server problem
502/503/504 → upstream/service problem
```

The exact meaning depends on the API contract.

Do not automatically rewrite frontend logic when the server is returning an invalid response.

---

# 10. Data Flow Debugging

Trace:

```text
User Action
↓
Event Handler
↓
State Update
↓
API Request
↓
Response
↓
Transformation
↓
State Update
↓
Render
```

Identify where the expected value disappears or becomes invalid.

---

# 11. Undefined / Null Errors

When encountering:

```text
Cannot read properties of undefined
```

do not simply add:

```ts
?. 
```

everywhere.

Determine why the value is undefined.

Possible causes:

* API response changed
* wrong property
* asynchronous state
* missing initial state
* incorrect data transformation
* unexpected empty response

Fix the data contract rather than hiding the problem.

---

# 12. Defensive Programming

Use defensive checks when missing data is genuinely valid.

Example:

```text
User has no profile image
```

should be handled intentionally.

But do not use defensive operators to hide programming errors.

Bad:

```ts
data?.user?.profile?.name?.first?.value
```

everywhere without understanding the structure.

---

# 13. React Debugging

When a React UI behaves incorrectly, inspect:

* props
* state
* context
* hooks
* effects
* keys
* conditional rendering
* component lifecycle
* parent re-renders

Ask:

```text
What changed?
Why did it change?
Which component rendered?
What data did it receive?
```

---

# 14. Infinite Render Loops

Common causes:

* state updates during render
* incorrect effects
* effect dependency loops
* unstable dependencies
* derived state updates

Example problematic pattern:

```text
render
↓
setState
↓
render
↓
setState
↓
...
```

Find the state update causing the cycle.

Do not suppress the symptom.

---

# 15. useEffect Debugging

When an effect behaves unexpectedly:

Check:

* dependencies
* values captured by closure
* cleanup
* whether the effect is actually necessary
* whether state updates trigger the effect again
* whether Strict Mode exposes an existing issue

Do not automatically add or remove dependencies until the intended data flow is understood.

---

# 16. Stale Closures

Watch for asynchronous callbacks using outdated state.

Examples:

```text
setTimeout
event listener
subscription
WebSocket
async function
```

Determine whether the callback captures stale values.

Fix the state/data flow rather than randomly adding dependencies.

---

# 17. Race Conditions

Frontend race conditions can occur when multiple async operations overlap.

Example:

```text
Search "react"
↓
Request A

Search "react router"
↓
Request B

B finishes
↓
UI shows B

A finishes later
↓
UI incorrectly shows A
```

Possible solutions:

* request cancellation
* request IDs
* appropriate server-state management
* ignoring stale responses

Choose based on the application architecture.

---

# 18. State Debugging

When state is incorrect, identify:

```text
Who owns the state?
Who updates it?
Who reads it?
When does it change?
What triggers the update?
```

Avoid moving state globally merely because debugging local state is difficult.

---

# 19. Props Debugging

When a child receives incorrect props:

Trace upward.

```text
Child
↑
Parent
↑
Parent state
↑
API/data source
```

Do not patch the child with assumptions if the parent is supplying incorrect data.

---

# 20. Context Debugging

If context values are missing:

Check:

* Provider location
* component hierarchy
* provider value
* default value
* multiple providers
* route boundaries

A component may be rendered outside the expected provider.

---

# 21. Routing Debugging

When navigation fails, inspect:

* route definition
* route path
* nested route
* basename
* router provider
* redirects
* protected route logic
* URL encoding
* query parameters

Test direct navigation to the problematic URL.

---

# 22. Authentication Debugging

When login/session behavior fails, inspect:

```text
Login request
↓
Response
↓
Token/session
↓
Storage/cookie
↓
Auth state
↓
Protected route
↓
API request
```

Determine exactly where the chain breaks.

Do not immediately rewrite the authentication system.

---

# 23. CORS Debugging

When CORS errors appear:

Determine:

* request origin
* API origin
* preflight behavior
* HTTP method
* headers
* backend configuration

Do not attempt to "fix CORS" by disabling browser security.

CORS is primarily a server configuration concern.

---

# 24. Environment Debugging

When something works locally but not elsewhere, inspect:

* environment variables
* API URLs
* build mode
* base paths
* deployment configuration
* feature flags
* browser differences

Never expose secrets while debugging.

---

# 25. Build Errors

For build failures inspect:

* imports
* exports
* paths
* case sensitivity
* dependencies
* TypeScript
* bundler configuration
* environment variables
* syntax

A project may work on Windows and fail on Linux because of path casing.

---

# 26. Module Errors

For:

```text
Module not found
```

check:

1. Does the file exist?
2. Is the path correct?
3. Is casing correct?
4. Is the export correct?
5. Is the dependency installed?
6. Is the alias configured?
7. Is the build tool resolving the same path?

Do not reinstall every dependency blindly.

---

# 27. TypeScript Errors

When TypeScript reports an error:

Understand:

* expected type
* actual type
* source of mismatch
* whether the type or implementation is incorrect

Do not solve everything with:

```ts
as any
```

or:

```ts
as unknown as SomeType
```

unless the cast is genuinely justified.

---

# 28. CSS Debugging

When a UI looks wrong, inspect:

* box model
* width
* height
* margin
* padding
* display
* position
* z-index
* overflow
* flex behavior
* grid behavior
* inherited styles
* media queries

Use browser DevTools where available.

Do not randomly add:

```css
!important
```

as a first response.

---

# 29. Layout Debugging

When alignment is incorrect:

Determine the layout context first.

Ask:

```text
Is this Flexbox?
Grid?
Normal flow?
Absolute positioning?
Container constraint?
```

Fix the parent layout when the parent is causing the problem.

Do not compensate with arbitrary child offsets.

---

# 30. Z-Index Debugging

When something is behind another element:

Inspect:

* stacking contexts
* positioned elements
* transforms
* opacity
* filters
* z-index hierarchy

Do not simply set:

```css
z-index: 999999;
```

Understand the stacking context.

---

# 31. Responsive Debugging

When a UI breaks on mobile:

Determine:

* breakpoint
* overflowing element
* fixed width
* minimum width
* text wrapping
* flex shrinking
* grid columns
* image dimensions
* viewport assumptions

Do not solve every responsive issue with:

```css
overflow-x: auto;
```

unless horizontal scrolling is actually appropriate.

---

# 32. Browser Differences

If behavior differs across browsers, compare:

* supported APIs
* CSS behavior
* default styles
* date parsing
* storage behavior
* permissions
* rendering behavior

Do not assume Chrome behavior is universal.

---

# 33. Hydration Errors

For SSR applications, hydration mismatches can arise from:

* browser-only APIs
* random values
* timestamps
* differing server/client data
* conditional rendering
* locale differences

Ensure server and client produce compatible initial output.

Do not suppress hydration warnings without understanding the cause.

---

# 34. Performance Debugging

When an application is slow:

Do not immediately add:

```text
memo
useMemo
useCallback
```

First identify:

* slow network
* large bundle
* excessive rendering
* expensive computation
* large DOM
* large images
* blocking JavaScript

Use profiling tools when available.

---

# 35. Memory Leak Debugging

Look for:

* event listeners
* timers
* subscriptions
* WebSockets
* observers
* stale references
* unbounded caches

Check cleanup behavior.

---

# 36. Event Listener Debugging

When listeners behave unexpectedly:

Check:

* where they are registered
* whether they are registered repeatedly
* whether cleanup exists
* whether the callback is stale
* whether multiple listeners exist

A common bug:

```text
render
↓
addEventListener
↓
render
↓
addEventListener
↓
multiple callbacks
```

---

# 37. Async Debugging

For async bugs, map:

```text
start
↓
await
↓
response
↓
validation
↓
state update
↓
render
```

Check what happens when:

* request succeeds
* request fails
* request is slow
* component unmounts
* user navigates away
* multiple requests overlap

---

# 38. Error Boundaries

For applications that support them, use error boundaries to prevent localized rendering errors from destroying the entire application.

But do not use error boundaries to hide bugs.

Log/report the underlying problem appropriately.

---

# 39. Logging

Temporary debugging logs can be useful.

Use logs strategically:

```text
input
request
response
state transition
transformation
```

Avoid:

```text
console.log("here")
console.log("here2")
console.log("why")
```

When finished:

* remove unnecessary logs
* keep intentional production logging
* never log secrets or sensitive data

---

# 40. Binary Search Debugging

For complex problems, isolate the failure by narrowing the scope.

Example:

```text
Entire page
↓
Section
↓
Component
↓
Hook
↓
Function
↓
Specific line
```

Disable or isolate pieces temporarily when necessary.

Do not permanently remove functionality just to make the bug disappear.

---

# 41. Git-Assisted Debugging

When appropriate, inspect:

* recent changes
* commit history
* diffs
* dependency updates

If a feature worked before a change, compare the change.

For difficult regressions, use:

```text
git bisect
```

when appropriate.

---

# 42. Regression Identification

Ask:

> Did this ever work?

If yes:

```text
Working version
↓
What changed?
↓
Regression
```

This can dramatically narrow the search.

---

# 43. Minimal Reproduction

For complex bugs, create the smallest reproducible example.

Remove unrelated:

* components
* API calls
* dependencies
* state
* styling
* integrations

until the problem remains isolated.

Then solve the isolated problem.

---

# 44. Do Not Hide Errors

Never "fix" a problem by:

* suppressing errors
* swallowing exceptions
* removing validation
* disabling TypeScript
* disabling linting
* ignoring failed requests
* hiding UI states

Unless explicitly required, errors should remain observable to developers.

---

# 45. Root Cause vs Symptom

Example:

### Symptom

```text
Button does nothing.
```

### Possible root cause

```text
API request fails.
```

### Deeper root cause

```text
Frontend sends incorrect payload.
```

### Actual fix

Correct the payload construction.

Do not simply make the button appear to work.

---

# 46. Fix Strategy

Once the root cause is known:

Prefer the smallest correct fix.

Avoid:

```text
massive refactor
new dependency
global state migration
complete rewrite
```

when a localized fix solves the problem.

---

# 47. Verify the Fix

After fixing:

```text
Original reproduction
↓
Confirm resolved
↓
Related workflow
↓
Regression tests
↓
Build/typecheck/lint
```

A fix is incomplete until verified.

---

# 48. Debugging Checklist

Before declaring a bug fixed:

* [ ] Bug reproduced
* [ ] Error/message understood
* [ ] Root cause identified
* [ ] Fix addresses root cause
* [ ] Original reproduction works
* [ ] Related functionality works
* [ ] No new console errors
* [ ] Tests pass
* [ ] Build passes
* [ ] Type checking passes where applicable
* [ ] Lint passes where applicable
* [ ] No unnecessary workaround remains

---

# 49. Agent Behavior

When encountering an error:

### DO

* Read the full error.
* Inspect the stack trace.
* Reproduce the issue.
* Inspect relevant code.
* Inspect data flow.
* Inspect network requests when relevant.
* Form a hypothesis.
* Confirm the hypothesis.
* Fix the root cause.
* Test the fix.

### DO NOT

* Randomly modify files.
* Reinstall dependencies immediately.
* Add `any` to silence TypeScript.
* Add `!important` everywhere.
* Add arbitrary timeouts.
* Add `try/catch` just to hide errors.
* Disable linting.
* Disable type checking.
* Rewrite the application.
* Declare success without verification.

---

# 50. Debugging Decision Tree

Use this mental model:

```text
Problem
  ↓
Can it be reproduced?
  ├── No → Gather more evidence
  └── Yes
       ↓
Where does it fail?
       ├── UI
       ├── State
       ├── Network
       ├── Data
       ├── Routing
       ├── Build
       ├── Environment
       └── Browser
             ↓
Trace upstream
             ↓
Find root cause
             ↓
Minimal correct fix
             ↓
Verify
             ↓
Regression check
```

---

# 51. Final Principle

Always remember:

> Debugging is not guessing until the error disappears.

Debugging is the process of understanding why the system behaves incorrectly and correcting the underlying cause.

The goal is:

> Reproducible diagnosis + Root-cause fix + Verified behavior
