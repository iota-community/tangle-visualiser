const dotenv = require('dotenv');
const Iota = require('iota.lib.js');
const zmq = require('zeromq').socket('sub');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const path = require('path');
const Loki = require('lokijs');

/* Global url variables */
dotenv.config();
const port = process.env.PORT || 3000;
const url = process.env.APP_URL || `http://localhost:${port}`;
const iriUrl = process.env.IRI_URL || 'http://localhost:14265';
const zmqUrl = process.env.ZMQ_URL || 'tcp://localhost:5556';
const explorerURL = process.env.EXPLORER_URL || 'https://thetangle.org/transaction/#ID';

/* Express application */
const app = express();
const server = http.createServer(app);
const io = socketio.listen(server);

server.listen(port, () => {
	console.log(`Visualiser running on ${port}`);
});

/** IOTA visualiser server side class */
class Visualiser {
	constructor() {
		/** Statistics state object
		 * @param stats.milestone Current Tangle milestone
		 * @param stats.tpm Transactions per time frame
		 * @param stats.index Total tips in db
		 * @param stats.tvpm Transactions with value per time frame
		 * @param stats.ipm Value transfered per time frame
		 * @param stats.apm Transactions accepted per minute
		 * @param stats.avpm Transactions with value accepted per minute
		 */
		this.stats = {
			milestone: 0,
			index: 0,
			tpm: 0,
			tvpm: 0,
			ipm: 0,
			apm: 0,
			avpm: 0,
		};

		/* Current tip batch load */
		this.load = [];

		/* Initialise database */
		const db = new Loki('visualiser.db');
		this.db = db.addCollection('txs');

		/* Initialise node api */
		this.IOTA = new Iota({
			provider: iriUrl,
		});

		/* Initialise ZMQ */
		zmq.connect(zmqUrl);
		zmq.subscribe('sn');
		zmq.subscribe('tx');
		zmq.subscribe('lmi');
		zmq.on('message', (msg) => {
			const data = msg.toString().split(' ');
			switch (data[0]) {
				case 'tx':
					this.addTransaction(data);
					break;
				case 'sn':
					this.addConfirmation(data);
					break;
				case 'lmi':
					this.stats.milestone = data[2];
					break;
				default:
					break;
			}
		});

		/* Initalise sockets */
		io.on('connection', (socket) => {
			socket.emit('welcome', this.stats);
			socket.on('history', (index) => {
				const history = this.getHistory(index);
				socket.emit('tips', history);
			});
		});

		/* Initialise web server */
		app.use('/vivagraph', express.static(`${__dirname}/node_modules/vivagraphjs/dist/`));
		app.use(express.static(path.join(__dirname, 'assets')));
		app.set('view engine', 'pug');
		app.get('/', (req, res) => {
			res.render('index', { url, explorerURL });
		});
	}

	/** Set stats reporting timer
	 * @param {Number} statsTime - Average stats time interval
	 * @param {Number} tipsTime - New transaction bulk interval
	 */
	setTimers(statsTime, tipsTime) {
		if (this.statsInterval) clearInterval(this.statsInterval);
		this.statsInterval = setInterval(() => {
			this.sendStats();
		}, statsTime);

		if (this.tipsInterval) clearInterval(this.tipsInterval);
		this.tipsInterval = setInterval(() => {
			this.sendTips();
		}, tipsTime);
	}

	/** Get transaction history
	 * @param {Number} Index - History data transaction index
	 */
	getHistory(index) {
		const tips = this.db
			.chain()
			.find({ index: { $gte: index - 100, $lt: index } })
			.data();
		return {
			tips: tips.map((tip) => {
				return {
					v: tip.v,
					h: tip.h,
					t: tip.t,
					b: tip.b,
				};
			}),
		};
	}

	/** Send new tips on batch to client and clear the batch load */
	sendTips() {
		if (this.load.length) io.emit('tips', { tips: this.load });
		this.load = [];
	}

	/** Send last batch stats to client and clear stats */
	sendStats() {
		io.emit('stats', this.stats);
		this.stats = Object.assign(this.stats, {
			tpm: 0,
			tvpm: 0,
			ipm: 0,
			apm: 0,
			avpm: 0,
		});
	}

	/** Append new transaction to db and ommit stats
	 * @param {Array} Transaction - Transaction data array received from ZMQ
	 */
	addTransaction(tx) {
		const value = parseFloat(tx[3]) > 0 ? parseFloat(tx[3]) : 0;

		this.stats.tpm += 1;
		if (value > 0) {
			this.stats.tvpm += 1;
		}

		this.stats.ipm += value;

		const tip = {
			index: this.stats.index,
			v: value,
			h: tx[1],
			t: tx[9],
			b: tx[10],
		};

		this.load.push(tip);
		this.db.insert(tip);
		this.stats.index += 1;
	}

	/** Ommit stats for a new transaction confirmation
	 * @param {Array} Transaction - Transaction data array received from ZMQ
	 */
	async addConfirmation(tx) {
		this.stats.apm += 1;

		const hash = tx[2];
		const txObj = await this.getTransaction(hash);

		if (txObj.length === 1 && txObj[0].value > 0) {
			this.stats.avpm += 1;
		}
	}

	/** Ommit stats for a new transaction confirmation
	 * @param {String} Hash - Transaction hash
	 * @returns {Array} Array of a single transaction object
	 */
	async getTransaction(hash) {
		return new Promise((resolve, reject) => {
			this.IOTA.api.getTransactionsObjects([hash], (error, data) => {
				if (error) {
					reject(error);
				} else {
					resolve(data);
				}
			});
		});
	}
}

const visualiser = new Visualiser();
visualiser.setTimers(60000, 5000);
