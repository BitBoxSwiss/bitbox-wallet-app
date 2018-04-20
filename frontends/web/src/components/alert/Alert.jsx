import { Component } from 'preact';
import style from './Alert.css';

export default class Alert extends Component {
  state = {
    context: '',
    active: false,
  }

  componentDidMount() {
    window.alert = this.overrideAlert;
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = e => {
    if (e.keyCode === 13 && this.state.active) this.setState({ active: false });
  }

  overrideAlert = str => {
    this.setState({
      context: str,
      active: true,
    });
  }

  render({}, {
    context,
    active,
  }) {
    const classes = active ? [style.overlay, style.active].join(' ') : style.overlay;
    return (
      <div class={classes}>
        <div class={style.alert}>
          <p>{context}</p>
          <div style="display: flex; flex-direction: row; justify-content: flex-end;">
            <button
              class={style.alertButton}
              onClick={() => this.setState({ active: false })}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }
}
