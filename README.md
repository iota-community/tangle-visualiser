# IOTA Tangle visualiser

This is the repository for the IOTA Tangle live transaction visualiser.

## Running the application

To build the application, follow these steps:

### 0. Start an IOTA Node

The visualiser requires a direct local access to a IOTA node for live [ZMQ messaging](https://github.com/iotaledger/iri/tree/dev/src/main/java/com/iota/iri/zmq). To enable ZMQ on your node, add this line to `iota.ini` file:

```
ZMQ_ENABLED = true
ZMQ_PORT = 5556
```

### 1. Install Node.JS

First you need to install [Node.JS](https://nodejs.org) if you haven’t done that already.

### 2. Install dependencies

Now you need to install dependencies. Do this by running:

```
npm install
```

### 3. Change default settings

Optionally, create an environment variable file `.env` with the following variables:

```
PORT=3000
APP_URL=http://localhost:3000
IRI_URL=http://localhost:14265
ZMQ_URL=tcp://localhost:5556
EXPLORER_URL=https://thetangle.org/transaction/#ID
```

### 4. Run the visualiser appplication

When the npm install is done, you can start the visualiser application by running:

```
npm start
```

After the command finished to load, open `http://localhost:3000` in a browser.
