
import * as React from "react";
import * as ReactDOM from "react-dom";
import { GlobalHotKeys } from 'react-hotkeys';


export class App extends React.Component
{
	public override render()
	{
		const keyMap = {
			SPACE: 'space',
		};

		const handlers = {
			SPACE: () => {
				console.log("space");
			},
		};

		return (
			<>
				Hello React
				<GlobalHotKeys keyMap={keyMap} handlers={handlers} />
			</>
		);
	}
}

ReactDOM.render(<App />, document.getElementById("App"));