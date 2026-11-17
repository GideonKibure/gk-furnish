type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  enterKeyHint?: "next" | "done";
};

/** Phone field. The customer keeps what they typed. The stored number is decided on blur or submit. */
export function PhoneField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  required = false,
  enterKeyHint = "next",
}: Props) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        id={id}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        enterKeyHint={enterKeyHint}
        className="field-input"
        placeholder="0692 713 993"
        value={value}
        aria-invalid={Boolean(error)}
        {...(error ? { "aria-describedby": `${id}-error` } : {})}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
