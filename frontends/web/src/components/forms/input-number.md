# Number Input Locale Handling

On iOS, `type="number"` can show a localized decimal key, such as a comma,
but the field rejects that comma before it receives a useful value.

For iOS, `NumberInput` uses `type="text"` with `inputMode="decimal"` so both
comma and dot can be entered. The visible value can keep the user's separator,
while `onChange` reports a canonical dot decimal value to callers.

This keeps app state and backend payloads locale independent, for example:

```text
visible input: 1,23
reported value: 1.23
backend value: 1.23
```

Non-iOS platforms keep the existing `type="number"` behavior.
