---
name: JSX Fragment in conditional rendering
description: Pattern for wrapping multiple JSX children inside && conditional without a div wrapper
---

When using `{condition && (...)}` in JSX to render multiple children via a Fragment,
the `<>` must immediately follow the opening paren:

CORRECT:
```jsx
{rightTab === "element" && (<>
  {selected ? <A /> : <B />}
</>)}
```

WRONG (causes "Unexpected token" parse error):
```jsx
{rightTab === "element" && (

  {selected ? <A /> : <B />}
)}
```

**Why:** JSX expression containers `{...}` expect a single expression. After `&& (`,
the parser enters a JS expression context. If the next token is `{` (a new JSX
expression), the parser gets confused — it must see a JSX element or value directly.
Opening a Fragment `<>` immediately after `(` is valid; a new `{expr}` is not.

**How to apply:** Always place `(<>` on the same line as the `&&`, never add a blank
line or a new `{...}` block between `(` and the Fragment opening tag.
