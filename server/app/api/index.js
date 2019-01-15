const { Router } = require('express');
const SerialPort = require('serialport');
const openPort = require('../utils/openPort');
const {
  identityParser,
  successParser,
  tempParser,
  transferSwitchParser,
  blankingCodeReadParser,
  filterBankIndParser,
  msfbSwitchParser,
  msfbFilterCheckParser,
} = require('../utils/prasers');

let port;

SerialPort.list().then(([comPort]) => {
  port = openPort(comPort.comName);
});

const api = Router();

api.get('/', async (req, res) => {
  const { command } = req.query;
  const response = await port.writeCommand(command.toUpperCase(), identityParser);
  res.send({ response });
});

api.get('/temp', async (req, res) => {
  const temperature = await port.writeCommand('TA000', tempParser);
  res.send({ temperature });
});

api.get('/transfer_switch', async (req, res) => {
  const { channel, on } = req.query;
  const status = await port.writeCommand(`2A${channel}${+!+on}0`, transferSwitchParser);
  res.send({ status });
});

const blanking = Router();

blanking.post('/', async (req, res) => {
  const { channel, on } = req.body;
  const success = await port.writeCommand(`BE${channel}${+on}0`, successParser);
  res.sendStatus(success ? 201 : 400);
});

blanking
  .route('/code')
  .get(async (req, res) => {
    const { channel } = req.query;
    const code = await port.writeCommand(`DR${channel}10`, blankingCodeReadParser);
    res.send({ code });
  })
  .post(async (req, res) => {
    const { channel, code } = req.body;
    const success = await port.writeCommand(`DW${channel}${code.toUpperCase()}`, successParser);
    res.sendStatus(success ? 201 : 400);
  });

api.use('/blanking', blanking);

const filterBank = Router();

filterBank.post('/indicator', async (req, res) => {
  const { channel } = req.body;
  const success = await port.writeCommand(`EA${channel}00`, filterBankIndParser);
  res.sendStatus(success ? 201 : 400);
});

filterBank.post('/mode', async (req, res) => {
  const { channel, mode } = req.body;
  let modeNumber;
  if (mode === 'low') modeNumber = 1;
  else if (mode === 'high') modeNumber = 2;
  else if (mode === 'break') modeNumber = 3;
  const success = await port.writeCommand(`DA${channel}${modeNumber}0`, successParser);
  res.sendStatus(success ? 201 : 400);
});

api.use('/filter_bank', filterBank);

api.post('/manual_attenuation', async (req, res) => {
  const { channel, level } = req.body;
  const success = await port.writeCommand(`5A1${channel}${level.toUpperCase()}`, successParser);
  res.sendStatus(success ? 201 : 400);
});

api.get('/msfb_switch', async (req, res) => {
  const { filter } = req.query;
  let switchValue = 0;
  if (filter === '3') switchValue = 1;
  else if (filter === '4') switchValue = 2;
  const switchResponse = await port.writeCommand(`MP${switchValue}00`, msfbSwitchParser);
  const filterResponse = await port.writeCommand(`MS000`, msfbFilterCheckParser(switchValue));
  res.send({ switchResponse, filterResponse });
});

module.exports = api;
