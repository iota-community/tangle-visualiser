/* global window, document, Viva, io, url, explorerURL */

const colors = {
	value: 0x00aa97ff,
	empty: 0x6340bbff,
	unconfirmed: 0x3e4040ff,
	line: 0x2e2e2eff,
	hover: 0xffffffff,
};

class Visualiser {
	constructor() {
		this.el = {
			tangle: document.getElementById('tangle'),
			hover: document.getElementById('hover'),
			stats: document.getElementById('stats'),
			log: document.getElementById('log'),
		};

		this.state = {
			init: false,
			log: false,
			index: 0,
		};

		this.stats = {};

		this.initGraph();
		this.initSocket();

		document.getElementById('hide').addEventListener('click', () => {
			document.getElementById('sidebar').classList.toggle('hidden');
		});

		document.getElementById('log-switch').addEventListener('click', (e) => {
			this.state.log = !this.state.log;
			if (this.state.log) {
				e.target.innerHTML = '[X] log';
			} else {
				e.target.innerHTML = '[&nbsp] log';
				this.el.log.innerHTML = '';
			}
		});

		document.getElementById('help').addEventListener('click', () => {
			document.getElementById('legend').classList.toggle('active');
		});
	}

	init() {
		this.state.init = true;
	}

	initGraph() {
		this.graph = Viva.Graph.graph();

		this.graphics = Viva.Graph.View.webglGraphics().link(() => {
			return Viva.Graph.View.webglLine(colors.line);
		});

		this.layout = Viva.Graph.Layout.forceDirected(this.graph, {
			stableThreshold: 0.0009,
			springLength: 80,
			springCoeff: 0.0008,
			dragCoeff: 0.1,
			gravity: -2.2,
			theta: 0.2,
		});

		this.renderer = Viva.Graph.View.renderer(this.graph, {
			container: document.querySelector('#tangle'),
			graphics: this.graphics,
			layout: this.layout,
			prerender: true,
			interactive: 'drag',
		});
		this.renderer.run();
		for (let i = 0; i < 20; i += 1) {
			this.renderer.zoomOut();
		}

		this.inputs = Viva.Graph.webglInputEvents(this.graphics, this.graph);
		this.inputs
			.mouseEnter((node) => {
				if (this.state.node) {
					this.setColor(this.state.node);
					this.state.node = null;
				}
				const value = node.data ? node.data.value : 0;

				this.el.hover.innerHTML = `<span>${Visualiser.convert(value, '')}</span> ${node.id}`;
				document.body.className = 'hover';

				const hoverNode = this.graphics.getNodeUI(node.id);
				hoverNode.color = colors.hover;

				this.state.node = node;
			})
			.mouseLeave((node) => {
				this.el.hover.innerHTML = '';
				document.body.className = '';
				this.setColor(node);
			})
			.click((node) => {
				window.open(explorerURL.replace('#ID', node.id));
			});

		this.el.tangle.addEventListener(
			'wheel',
			(e) => {
				if (e.deltaY > 0) {
					this.renderer.zoomOut();
				} else {
					this.renderer.zoomIn();
				}
			},
			false,
		);
	}

	initSocket() {
		this.socket = io(url);

		this.socket.on('welcome', (data) => {
			this.stats = data;
			this.state.index = data.index;
			this.socket.emit('history', data.index);
			this.state.index -= 100;
			this.setStats();
		});

		this.socket.on('tip', (doc) => {
			this.addTip(doc.tip.hashes);
			this.setStats();
		});

		this.socket.on('stats', (data) => {
			this.stats = data;
			this.setStats();
		});

		this.socket.on('tips', (doc) => {
			doc.tips.forEach((data, index) => {
				this.addTip(data);
				if (this.state.log && index < 5) {
					const className = data.v > 0 ? 'f' : 'e';
					const logItem = document.createElement('p');
					logItem.innerHTML = `<span class="${className}">${Visualiser.convert(data.v, '')}</span>${data.h}`;
					logItem.addEventListener('click', () => {
						window.open(explorerURL.replace('#ID', data.h));
					});
					this.el.log.appendChild(logItem);
					if (this.el.log.children.length > 6) {
						this.el.log.removeChild(this.el.log.children[0]);
					}
				}
			});
			this.setStats();
		});
	}

	setStats() {
		this.el.stats.innerHTML = `<p class="b">${this.stats.tpm}&nbsp;&nbsp;t/m</p><p class="b">${Visualiser.convert(
			this.stats.ipm,
			'&nbsp;',
		)}/m</p><p>#${this.stats.milestone}</span> milestone</p><p>${this.graph.getNodesCount()} transactions</p>`;

		if (this.state.index > 100) {
			this.el.stats.innerHTML = `${this.el.stats.innerHTML}<a id="load-more">+ load more</a>`;
			document.getElementById('load-more').addEventListener('click', () => {
				this.socket.emit('history', this.state.index);
				this.state.index -= 100;
			});
		}
	}

	static convert(value, divider) {
		if (!value) return `0${divider}I`;
		const units = [`${divider}I`, 'KI', 'MI', 'GI', 'TI'];
		const length = Math.floor(value.toString().length / 3);
		const pow = 1000 ** length;
		const o = parseFloat((length !== 0 ? value / pow : value).toPrecision(2));
		return o + divider + units[length];
	}

	setColor(target) {
		const node = this.graphics.getNodeUI(target.id);
		if (target.links.length > 2) {
			if (target.data && target.data.value > 0) {
				node.color = colors.value;
			} else {
				node.color = colors.empty;
			}
		} else {
			node.color = colors.unconfirmed;
		}
	}

	addTip(tip) {
		this.graph.addNode(tip.h, {
			value: tip.v,
		});
		this.graph.addLink(tip.h, tip.t);
		this.graph.addLink(tip.h, tip.b);

		this.setColor(this.graph.getNode(tip.t));
		this.setColor(this.graph.getNode(tip.b));
		this.setColor(this.graph.getNode(tip.h));
	}
}

const visualiser = new Visualiser();
visualiser.init();
