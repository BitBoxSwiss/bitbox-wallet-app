import { Component } from 'preact';
import style from './InlineMessage.css';

export default class InlineMessage extends Component {
	state = {
		active: true,
	}

	componentDidMount() {
		setTimeout(this.deactivate, 3000);
	}

	deactivate = () => {
		this.props.onEnd();
	}

	render({
		type,
		message,
		align,
	}, {

	}) {
		return (
			<div class={[style.inlineMessage, style[type], align ? style[align] : ''].join(' ')}>
				{message}
				<div class={style.close} onClick={this.deactivate}>✕</div>
			</div>
		);
	}
}
