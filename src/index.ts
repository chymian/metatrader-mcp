#!/usr/bin/env node
import { Mt5Server } from './mt5-server.js';

const server = new Mt5Server();
server.run().catch(console.error);
