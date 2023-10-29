'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');
const boolean = require('boolean');

const refreshTimeout = 1000 * 60; // 60 sec

module.exports = class ztatzP1FinancialDayDevice extends Device {

	// this method is called when the Device is inited
	async _initDevice() {
		this.log('_initDevice');
		const device = this.getData();

		// Register flowcard triggers
		//this._registerFlowCardTriggers();

		// Update server data
		//this._syncDevice();

		// Set update timer
		this.intervalId = setInterval(this._syncDevice.bind(this), refreshTimeout);
		this.setSettings({
			url: device.url,
		});

		if(!this.hasCapability('money.todaywater')){
			this.addCapability('money.todaywater');
		}
	}

	async _deleteDevice() {
		this.log('_deleteDevice');

		clearInterval(this.intervalId);
	}

	// Update server data
	async _syncDevice() {
		try {
			let status = await this.api.getFinancialDay();
			this.log(status)

			if(status == false){
				this.setUnavailable(this.api.lastError)
				return
			} 

			if (status.length != 0) {
				this.setAvailable();

				let usageLow = status[0][2]
				let usageHigh = status[0][3]
				let generationLow = status[0][4]
				let generationHigh = status[0][5]
				let usageGas = status[0][6]
				let usageWater = status[0][7]

				this.setCapabilityValue('money.todayused', Number(usageLow) + Number(usageHigh));
				this.setCapabilityValue('money.todaygen', Number(generationLow) + Number(generationHigh));
				this.setCapabilityValue('money.todaygas', Number(usageGas));
				this.setCapabilityValue('money.todaywater', Number(usageWater));

			} else {
				this.setUnavailable('Cannot refresh / Connect');
			}


		} catch (error) {
			this.error(error);
			this.setUnavailable(error.message);
		}
	}

	// this method is called when the Device has requested a state change (turned on or off)
	//async p1_kwh_used( value, opts ) {

	// ... set value to real device, e.g.
	// await setMyDeviceState({ on: value });

	// or, throw an error
	// throw new Error('Switching the device failed!');
	//}

}