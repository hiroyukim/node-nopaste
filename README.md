node-nopaste
==============

node-nopaste is a server that shares a temporary code .(default mode: "onmemory")

Note
----

The default behavior of nopaste is disappears contents of the server was shutdown Then record because "onmemory".
It is recommended that you use by specifying the "redis" from the environment variable `NODE_NOPASTE_STORAGE_TYPE`.

```bash
export NODE_ENV=production && export NODE_NOPASTE_STORAGE_TYPE=redis && npm start|/path/to/node-nopaste/bin/node-nopaste
```

## Installation

Run the following command

    $ npm install node-nopaste

Then to make sure the dependencies are installed:

    $ npm install

