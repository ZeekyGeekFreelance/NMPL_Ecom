"use client";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      type={props.type || "button"}
      className={`btn-base active:scale-[0.99] ${className || ""}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
