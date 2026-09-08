import { useState } from "react";
import { useLocale } from "../contexts/LocaleContext";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const { t } = useLocale();
  return <span className="password-input"><input {...props} type={visible ? "text" : "password"} /><button type="button" aria-label={t(visible ? "auth.hidePassword" : "auth.showPassword")} onMouseDown={(event) => event.preventDefault()} onClick={() => setVisible((value) => !value)}>{visible ? "◉" : "○"}</button></span>;
}
