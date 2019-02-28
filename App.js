import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View,
  Button,
  TouchableHighlight,
  NativeAppEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
  ListView,
  ScrollView,
  AppState,
  Dimensions,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import arraybuffer from "arraybuffer-to-string";
import { stringToBytes } from 'convert-string'

const window = Dimensions.get('window');
const ds = new ListView.DataSource({rowHasChanged: (r1, r2) => r1 !== r2});

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

export default class App extends Component {
  constructor(){
    super()

    this.state = {
      scanning:false,
      peripherals: new Map(),
      appState: '',
      toggle : false,
      device:"",
      buttons:{
        0:false,
        1:false,
        2:false
      },
      connected:false
    }

    this.handleDiscoverPeripheral = this.handleDiscoverPeripheral.bind(this);
    this.handleStopScan = this.handleStopScan.bind(this);
    this.handleUpdateValueForCharacteristic = this.handleUpdateValueForCharacteristic.bind(this);
    this.handleDisconnectedPeripheral = this.handleDisconnectedPeripheral.bind(this);
    this.handleAppStateChange = this.handleAppStateChange.bind(this);
  }

  componentDidMount() {
    AppState.addEventListener('change', this.handleAppStateChange);

    BleManager.start({
      showAlert: false,
      // forceLegacy: false   
    });

    this.handlerDiscover = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handleDiscoverPeripheral );
    this.handlerStop = bleManagerEmitter.addListener('BleManagerStopScan', this.handleStopScan );
    this.handlerDisconnect = bleManagerEmitter.addListener('BleManagerDisconnectPeripheral', this.handleDisconnectedPeripheral );
    this.handlerUpdate = bleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', this.handleUpdateValueForCharacteristic );



    if (Platform.OS === 'android' && Platform.Version >= 23) {
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
            if (result) {
              console.log("Permission is OK");
            } else {
              PermissionsAndroid.requestPermission(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then((result) => {
                if (result) {
                  console.log("User accept");
                } else {
                  console.log("User refuse");
                }
              });
            }
      });
    }

  }

  handleAppStateChange(nextAppState) {
    if (this.state.appState.match(/inactive|background/) && nextAppState === 'active') {
      console.log('App has come to the foreground!')
      BleManager.getConnectedPeripherals([]).then((peripheralsArray) => {
        console.log('Connected peripherals: ' + peripheralsArray.length);
      });
    }
    this.setState({appState: nextAppState});
  }

  componentWillUnmount() {
    this.handlerDiscover.remove();
    this.handlerStop.remove();
    this.handlerDisconnect.remove();
    this.handlerUpdate.remove();
  }

  handleDisconnectedPeripheral(data) {
    let peripherals = this.state.peripherals;
    let peripheral = peripherals.get(data.peripheral);
    if (peripheral) {
      peripheral.connected = false;
      peripherals.set(peripheral.id, peripheral);
      this.setState({peripherals});
    }
    console.log('Disconnected from ' + data.peripheral);
  }

  handleUpdateValueForCharacteristic(data) {
    console.log('Received data from ' + data.peripheral + ' characteristic ' + data.characteristic, data.value);
  }

  handleStopScan() {
    console.log('Scan is stopped');
    this.setState({ scanning: false });
  }

  startScan() {
    if (!this.state.scanning) {
      this.setState({peripherals: new Map()});
      BleManager.scan([], 5, true ).then((results) => {
        console.log('Scanning...');
        this.setState({scanning:true});
      });
    }
  }

  retrieveConnected(){
    BleManager.getConnectedPeripherals([]).then((results) => {
      if (results.length == 0) {
        console.log('No connected peripherals')
      }
      console.log(results);
      var peripherals = this.state.peripherals;
      for (var i = 0; i < results.length; i++) {
        var peripheral = results[i];
        peripheral.connected = true;
        peripherals.set(peripheral.id, peripheral);
        this.setState({ peripherals });
      }
    });
  }

  handleDiscoverPeripheral(peripheral){
    var peripherals = this.state.peripherals;
    if (!peripherals.has(peripheral.id)){
      console.log('Got ble peripheral', peripheral);
      peripherals.set(peripheral.id, peripheral);
      this.setState({ peripherals })
    }
  }

  sendData = (e) => value => {
    // console.log("devices" ,this.state.peripherals);
    console.log("devices-----" ,this.state.device);
    // console.log("devices-----" ,this.state.toggle);

    this.togle();
    // console.log(this.state.device.characteristics[4].service);

    let {device} = this.state;
    let service = device.characteristics[4].service;
    let characteristic = device.characteristics[4].characteristic;

    console.log(e)
    this.setState({buttons: {
      ...this.state.buttons,
      [e]: !this.state.buttons[e]
      }
    }, () => {
      let val = Object.values(this.state.buttons).map(item => item?'1':'0').join('');
      console.log(val)
      let data = stringToBytes(val);
      
      BleManager.write(device.id, service, characteristic, data)
        .then(() => {
          // Success code
          console.log('Write: ' + data);
        })
        .catch((error) => {
          // Failure code
          console.log(error);
        });
    })
    // arr[e] = !this.state.buttons[e] ? 1 : 0; 
    // console.log(arr);
    
    
    
    
    // arr[e-1] = this.state.buttons.e
    
    
  }

  togle = () =>{
    this.setState({ toggle : !this.state.toggle })
  }

  test(peripheral) {
    if (peripheral){
      if (peripheral.connected){ 
        BleManager.disconnect(peripheral.id);
        this.setState({connected:false})
      }else{ 
        BleManager.connect(peripheral.id).then(async () => {
          let peripherals = this.state.peripherals;
          let p = peripherals.get(peripheral.id);
          if (p) {
            p.connected = true;
            peripherals.set(peripheral.id, p);
            this.setState({peripherals});
          }
          console.log('Connected to ' + peripheral.id);


          setTimeout(async() => {

            BleManager.retrieveServices(peripheral.id).then((peripheralInfo) => {
              console.log(peripheralInfo ,"<<");

              var service = peripheralInfo.characteristics[4].service;
              var characteristic = peripheralInfo.characteristics[4].characteristic;
              // console.log("id >",peripheral.id);
              this.setState({device:peripheralInfo ,connected : true})
              
              BleManager.read(peripheral.id,service , characteristic)
                .then((readData) => {
                  // Success code
                  // console.log('Read: ' + readData);
                  
                  let buffer = new Uint8Array(readData);
                  
                  arraybuffer(buffer);
                  console.log("data ==" ,arraybuffer(buffer));
                  
                })
                .catch((error) => {
                  // Failure code
                  console.log(error);
                });
            }).catch(err => console.log(err));

          }, 2000);
        }).catch((error) => {
          console.log('Connection error', error);
        });
      }
    }
  }

  render() {
    const list = Array.from(this.state.peripherals.values());
    const dataSource = ds.cloneWithRows(list);
    let scan = this.state.scanning ? "#ff8484":"#a2a7ab";

    return (
      <View style={styles.container}>
        <View style={{flexDirection:"row"}}>
          <TouchableHighlight underlayColor="#ddf0fd"
                              style={{marginTop: 20,marginRight: 2, padding:10, backgroundColor:scan }} 
                              onPress={() => this.startScan() }>
            
            <Text style={{textAlign:"center" , color:"white"}}>
              Scan Bluetooth ({this.state.scanning ? 'on' : 'off'})
            </Text>
          </TouchableHighlight>
          <TouchableHighlight underlayColor="#ddf0fd"
                              style={{marginTop: 20,marginLeft: 2, padding:10, backgroundColor:"#a2a7ab"}} 
                              onPress={() => this.retrieveConnected() }>
            
            <Text style={{textAlign:"center" , color:"white"}}>
              Retrieve connected peripherals
            </Text>
          </TouchableHighlight>
        </View>
        
        {!this.state.scanning ? <ScrollView style={styles.scroll}>
          {(list.length == 0) &&
            <View style={{flex:1, margin: 20}}>
              <Text style={{textAlign: 'center'}}>No peripherals</Text>
            </View>
          }
        <ListView
            enableEmptySections={true}
            dataSource={dataSource}
            renderRow={(item) => {
              const color = item.connected ? '#a0ffbe' : '#d2e6f3';
              return (
                <View>
                  <View style={{backgroundColor: color , borderRadius:10,margin:5,elevation:7}} >
                    <View style={{flexDirection:"row" ,justifyContent:"space-between",alignContent:"center"}}>
                        <View style={{flexDirection:"row" }} >
                          <Text style={styles.circle}>{item.rssi}</Text>
                          <Text style={{fontSize: 15,  color: '#333333',padding:10}}>
                            {item.name != null ? item.name : "n/a"}
                          </Text>
                        </View>
                        <TouchableHighlight underlayColor="#d2e6f3" style={{padding:10 }} onPress={() => this.test(item) }>
                          <View style={{backgroundColor:"green" , padding:5 ,borderRadius:50,width:90}}>
                            <Text style={{color:"white",textAlign:"center"}}>
                              {item.connected ? "Disconnect" : "Connect"}
                            </Text>
                          </View>
                        </TouchableHighlight>
                      
                    </View>
                    <Text style={{fontSize: 8,  color: '#333333', padding: 10}}>{item.id}</Text>
                  </View>
                  
                </View>
         
              );
            }}
          />
          </ScrollView> : <View style={styles.scroll}>
              <View style={{flex:1, margin: 20}}>
                <Text style={{textAlign: 'center'}}>Scanning...</Text>
              </View>
          </View> }    
          {this.state.connected ?  
              <View style={styles.buttons}>
                <View style={styles.button }>
                  <Button 
                    title="1" 
                    color={this.state.buttons[0] ? '#0fb132':'#e02b2b'} 
                    onPress={this.sendData(0)}
                  ></Button>
                </View>
                <View style={styles.button }>
                  <Button 
                    title="2" 
                    color={this.state.buttons[1] ? '#0fb132':'#e02b2b'}
                    onPress={this.sendData(1)}
                  ></Button>
                </View>
                <View style={styles.button }>
                  <Button 
                    title="3" 
                    color={this.state.buttons[2] ? '#0fb132':'#e02b2b'}
                    onPress={this.sendData(2)}
                  ></Button> 
                </View> 
              </View>
              : null} 
        
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ddf0fd',
    width: window.width,
    height: window.height
  },
  scroll: {
    flex: 1,
  },
  row: {
    margin: 10
  },
  circle:{
    backgroundColor:"orange",
    borderRadius:50,
    width:30,
    height:30,
    padding:5,
    alignSelf:"center",
    marginLeft:5
  },
  buttons:{
    flex:1,
    flexDirection:"row",
    justifyContent :"space-around",
  },
  button :{
    width:50
  },
  list:{
    color:"red",
    backgroundColor:"red"
  }
});