import { useState } from "react";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input"><input {...props} type={visible ? "text" : "password"} /><button type="button" aria-label={visible ? "Скрыть пароль" : "Показать пароль"} onMouseDown={(event) => event.preventDefault()} onClick={() => setVisible((value) => !value)}>{visible ? "◉" : "○"}</button></span>;
}
