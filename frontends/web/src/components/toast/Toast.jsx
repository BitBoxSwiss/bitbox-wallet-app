import { Component } from 'preact';
import style from './Toast.css';

export default class Toast extends Component {
  state = {
    active: false,
  }

  componentDidUpdate(prevProps, prevState) {
    if (!prevProps.trigger && this.props.trigger) {
      this.setState({ active: true });
      setTimeout(this.hide, 5000);
    }
  }

  hide = () => {
    this.setState({ active: false });
    this.props.onHide();
  }

  render({
    theme,
    message,
  }, {
    active,
  }) {
    return (
      <div class={[style.toast, style[theme], active ? style.active : style.disabled].join(' ')} ref={toast => this.toast = toast}>
        {message}
      </div>
    );
  }
}
