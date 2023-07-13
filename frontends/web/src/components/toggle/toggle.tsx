import style from './toggle.module.css';

export type TToggleProps = JSX.IntrinsicElements['input']

export const Toggle = (
  {
    className = '',
    ...props
  }: TToggleProps
) => {
  return (
    <label className={`${style.container} ${className}`}>
      <input
        type="checkbox"
        {...props} />
      <span className={style.slider}></span>
    </label>
  );
};
