'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');
const boolean = require('boolean');

const refreshTimeout = 1000 * 10; // 10 sec
const refreshTimeoutStats = 1000 * 300; // 5 min

module.exports = class ztatzP1SmartMeterDevice extends Device {

	// this method is called when the Device is inited
	async _initDevice() {
		this.log('_initDevice');
		const device = this.getData();
		this.config = this.getSettings();
		this.config.debug = false
		this.refreshing = false
		this.refreshingStats = false
		this.setSettings({
			debug: false
		})
		// Register flowcard triggers
		//this._registerFlowCardTriggers();

		// Update server data
		this.intervalStatsId = setInterval(this._syncStats.bind(this), refreshTimeoutStats);

		// Set update timer
		this.intervalId = setInterval(this._syncDevice.bind(this), refreshTimeout);
		this.setSettings({
			url: device.url,
		});

		// Add version Capablity
		if(!this.hasCapability('version_number')){
			this.addCapability('version_number');
		}

		if(!this.hasCapability('measure_power')){
			this.addCapability('measure_power');
		}

		if(!this.hasCapability('meter_power.consumedL2')){
			this.addCapability('meter_power.consumedL2');
		}

		if(!this.hasCapability('meter_power.consumedL1')){
			this.addCapability('meter_power.consumedL1');
		}

		if(!this.hasCapability('meter_power.total')){
			this.addCapability('meter_power.total');
		}

		if(!this.hasCapability('meter_gas')){
			this.addCapability('meter_gas');
		}

		console.log("register flow triggers");
		// register Flow triggers
		this._flowTriggerPowerMeterL1Changed = this.homey.flow.getDeviceTriggerCard('meter_power.consumedL1.changed');
		this._flowTriggerPowerMeterL2Changed = this.homey.flow.getDeviceTriggerCard('meter_power.consumedL2.changed');
		this._flowTriggerPowerMeterTotalChanged = this.homey.flow.getDeviceTriggerCard('meter_power.consumedTotal.changed');
		this._flowTriggerGasMeterChanged = this.homey.flow.getDeviceTriggerCard('meter_gas.changed');
		this._flowTriggerVersionChanged = this.homey.flow.getDeviceTriggerCard('version_number.changed');

		this._syncStats();
	}

	async _deleteDevice() {
		this.log('_deleteDevice');

		clearInterval(this.intervalStatsId);
		clearInterval(this.intervalId);
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		this.config = newSettings
	}

	// Update server data
	async _syncDevice() {
		if(this.refreshing){
			this.setWarning("Refresh seems to take long...")
			this.writeDebug("Already refreshing")
			return
		}

		this.writeDebug("Refresh from "+ this.config.url)
		try {
			this.refreshing = true
			let status = await this.api.getSmartmeter();
			this.writeDebug("["+this.config.url+"] [STATUS] "+ JSON.stringify(status))
			this.refreshing = false

			if(status == false){
				this.setUnavailable(this.api.lastError)
				this.writeDebug("["+this.config.url+"] [ERROR] "+ this.api.lastError)
				return
			} 
			
			if (status.length != 0) {
				this.setAvailable();

				let usageLow = status[0][3]
				let usageHigh = status[0][4]
				let usageTotal = usageLow + usageHigh
				let currentUsage = status[0][8]
				let currentGas = status[0][10]
				let tariff = status[0][7]

				this.changeCapabilityValue('measure_power', Number(currentUsage));
				this.changeCapabilityValue('meter_power.consumedL2', Number(usageLow), this._flowTriggerPowerMeterL2Changed, {'meter_power.consumedL2':Number(usageLow)});
				this.changeCapabilityValue('meter_power.consumedL1', Number(usageHigh), this._flowTriggerPowerMeterL1Changed, {'meter_power.consumedL1':Number(usageHigh)});
				this.changeCapabilityValue('meter_power.total', Number(usageTotal), this._flowTriggerPowerMeterTotalChanged, {'meter_power.consumedTotal':Number(usageTotal)});
				this.changeCapabilityValue('meter_gas', Number(currentGas), this._flowTriggerGasMeterChanged, {'meter_gas':Number(currentGas)});

				let tariff_high = false;

				if(tariff == "P"){
					tariff_high = true;
				}

				this.changeCapabilityValue('tariff_high', tariff_high);

			} else {
				this.setUnavailable('Cannot refresh / Connect');
			}


		} catch (error) {
			this.error(error);
			this.setUnavailable(error.message);
		}
	}

	// Update stats
	async _syncStats() {
		if(this.refreshingStats){
			this.setWarning("Refresh seems to take long...")
			this.writeDebug("Already refreshing")
			return
		}

		this.writeDebug("Refresh from "+ this.config.url)
		try {
			this.refreshingStats = true
			let status = await this.api.getStatus();
			this.writeDebug("["+this.config.url+"] [STATUS] "+ JSON.stringify(status))
			this.refreshingStats = false
			if(status == false){
				this.setUnavailable(this.api.lastError)
				this.writeDebug("["+this.config.url+"] [ERROR] "+ this.api.lastError)
				return
			} 

			let configuration = await this.api.getConfiguration();
			this.writeDebug("["+this.config.url+"] [STATUS] "+ JSON.stringify(configuration))
			if(status == false){
				this.setUnavailable(this.api.lastError)
				this.writeDebug("["+this.config.url+"] [ERROR] "+ this.api.lastError)
				return
			} 

			if (status.length != 0 && configuration != 0) {
				this.setAvailable();

				let lastVersion = this.api.filterValueByLabel(status,"Laatste P1 monitor versie:")[0]
				let lastVersionText = this.api.filterValueByLabel(status,"Laatste P1 monitor versie tekst:")[0]
				let lastVersionDate = this.api.filterValueByLabel(status,"Laatste P1 monitor versie datum:")[0]
				let lastVersionUrl = this.api.filterValueByLabel(status,"Laatste P1 monitor versie URL:")[0]
				let lastVersionNumber = this.api.filterValueByLabel(status,"Laatste P1 monitor versie nummer:")[0]

				let currentVersion = this.api.filterValueByLabel(configuration,"Versie:","PARAMETER")[0]
				let currentVersionNumber = this.api.filterValueByLabel(configuration,"Versie nummer:")[0]

				try{
					this.changeCapabilityValue('version_number', Number(lastVersionNumber['STATUS']), this._flowTriggerVersionChanged, {'version':String(lastVersion['STATUS']),"version_number":Number(lastVersionNumber['STATUS']),"version_url":String(lastVersionUrl['STATUS']),"version_date":String(lastVersionDate['STATUS']),"version_name":String(lastVersionText['STATUS']),"current_version_number":Number(currentVersionNumber['PARAMETER'])});
				}catch (error){
					this.log(error)
				}
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