import React, { Component } from 'react';
import { Dimensions, NativeModules, NativeEventEmitter, Platform, PermissionsAndroid } from "react-native";
import { Container, Button, Text, Spinner, Toast } from 'native-base';
import BleManager from 'react-native-ble-manager';
import RNAndroidLocationEnabler from 'react-native-android-location-enabler';
import { stringToBytes, bytesToString } from "convert-string";
import { RSAKeychain } from 'react-native-rsa-native';
import { base64ToHex } from "../../utils/functions";

import * as STORAGE_NAMING from '../../utils/storage_naming';

import styles from './UnlockCSS';

// Nécessaire au BLE
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

// Informations en dur pour l'instant mais dans la BDD au final
const CYBER_KEY_ESP32_MAC_ADDR = "24:0A:C4:58:4F:0A"; // @MAC de l'ESP32 serrure
const CYBERKEY_SERVICE_UUID = "a4d6a5b6-2a84-11eb-adc1-0242ac120002"
const CHAR_UUID_RX_USER_ID = "a4d6a7d2-2a84-11eb-adc1-0242ac120002"
const CHAR_UUID_TX_CHALL = "a4d6ac1e-2a84-11eb-adc1-0242ac120002"
const CHAR_UUID_RX_USER_SIG = "a4d6a8c2-2a84-11eb-adc1-0242ac120002"

// MTU des transmissions
const MTU_SIZE = 512

/**
 * Classe représentant la page de déverrouillage de la porte.
 */
export default class Unlock extends Component {

    /**
     * Constructeur du composant.
     * @param {Object} props proprétés du composant
     */
    constructor(props) {
        super(props)
        this.state = {
            loading: false,
            scanning: false, // état du scan BLE
            cyberKeyESP32Found: false, // si l'ESP32 a été trouvé lors du scan
            cyberKeyESP32_peripheral: null, // l'objet représentant le périphérique ESP32
            connectedTo_cykerKeyESP32: false, // si on est connecté à l'ESP32
        }
    }

    /**
     * Méthode exécutée après le rendu du composant.
     * Ajoute les handler nécessaires à la connexion à l'ESP32.
     */
    componentDidMount() {

        this.handlerStopScan = bleManagerEmitter.addListener('BleManagerStopScan', this.handler_StopBLEScanning);
        this.handlerDiscoverPeripheral = bleManagerEmitter.addListener('BleManagerDiscoverPeripheral', this.handler_discoverNewBLEPeripheral)
    }
    
    /**
     * Méthode exécutée avant que le composant se démonte.
     * Retire les handlers.
     * Se déconnecte de l'ESP322 si l'on était connecté.
     */
    componentWillUnmount() {
        this.handlerStopScan.remove()
        this.handlerDiscoverPeripheral.remove()
        this.resetForReason()
    }

    /**
     * Demandes toutes les permissions nécessaires et demande d'activer le Bluetooth.
     * Retourne un Promise résolu si toutes les permissions sont OK et si le BT est activé.
     */
    checkPermissionsAndBT = () => {

        return new Promise((resolve, reject) => {
            
            if(Platform.OS === 'android') {
                let requestedPermissions = [PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION]
                if(Platform.Version >= 23 && Platform.Version < 29) {
                    requestedPermissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION)
                    PermissionsAndroid.requestMultiple(requestedPermissions)
                    .then((granted) => {
                        if(Object.values(granted).filter(p => p != PermissionsAndroid.RESULTS.GRANTED).length === 0) {
                            // Initialisation du module Bluetooth
                            BleManager.enableBluetooth()
                            .then(() => BleManager.start().then(() => resolve("All permissions and BT are ok.")))
                            .catch((error) => reject("Bluetooth non activé !"))
                        }
                        else {
                            reject("Permissions d'accès à la localisation non accordées !")
                        }
                    })
                }
                if(Platform.Version >= 29) {
                    requestedPermissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
                    PermissionsAndroid.requestMultiple(requestedPermissions)
                    .then((granted) => {
                        if(Object.values(granted).filter(p => p != PermissionsAndroid.RESULTS.GRANTED).length === 0) {

                            // Activation de la localisation pour BLE
                            RNAndroidLocationEnabler.promptForEnableLocationIfNeeded({interval: 10000, fastInterval: 5000})
                            .then(data => {
                                // Initialisation du module Bluetooth
                                BleManager.enableBluetooth()
                                .then(() => BleManager.start().then(() => resolve("All permissions and BT are ok.")))
                                .catch((error) => reject("Bluetooth non activé !"))
                            }).catch(err => {
                                //  - ERR00 : The user has clicked on Cancel button in the popup
                                //  - ERR01 : If the Settings change are unavailable
                                //  - ERR02 : If the popup has failed to open
                                console.log(err.code)
                                console.log(err.message)
                                reject("Localisation non activée !")
                            });
                        }
                        else {
                            reject("Permissions d'accès à la localisation non accordées !")
                        }
                    })
                }
            }
        })
    }

    /**
     * Débute le scan BLE.
     */
    beginBLEScanning = () => {
        if(!this.state.scanning) {
            BleManager
            .scan([], 1, true)
            .then((results) => {
                console.log("BLE Scanning started...")
                this.setState({scanning: true})
            })
            .catch((error) => console.log(`[beginBLEScanning] error = ${error}`))
        }
    }

    /**
     * Handler lorsque le scan BLE s'arrête
     * Gère la connexion avec l'ESP32 de la serrure si celui-ci a été découvert lors du scan des BLE.
     * S'il a été découvert, s'y connecte et négocie un MTU de MTU_SIZE octets (ordre de grandeur des futures envois d'informations).
     */
    handler_StopBLEScanning = (r) => {
        console.log("BLE Scanning ended... ")
        this.setState({scanning: false})

        // le scan n'a pas permis de trouver l'ESP32 de la serrure
        if(this.state.cyberKeyESP32Found === false) { 
            console.log("serrue non trouvée")
            this.resetForReason("Serrure non trouvée !")
        }
        else {
            BleManager.connect(this.state.cyberKeyESP32_peripheral.id)
                .then(() => {
                    console.log("Connected to CykerKey ESP32")
                    this.setState({connectedTo_cykerKeyESP32: true})
                    BleManager.requestMTU(this.state.cyberKeyESP32_peripheral.id, MTU_SIZE)
                        .then((mtu) => {
                            console.log(`MTU = ${mtu} bytes for this connection`)
                            this.launchUnlockProcedure()
                        })
                        .catch((error) => {
                            console.log(`[handler_StopBLEScanning] requestMTU error = ${error}`)
                            this.resetForReason("Erreur de procédure, recommencer !")
                        })
                })
                .catch((error) => {
                    console.log(`[handler_StopBLEScanning] connection error = ${error}`)
                    this.resetForReason("Erreur de connexion à la serrure !")
                })  
        }
    }

    /**
     * Handler lorsqu'un nouveau périphérique BLE est trouvé.
     * Lorsque le nouveau périphérique BLE découvert correspond à la l'ESP32 de la serrure alors met à jour l'état du composant.
     * @param {Object} peripheral objet représentant un périphérique
     */
    handler_discoverNewBLEPeripheral = (peripheral) => {
        console.log(peripheral.id)
        
        if(peripheral.id === CYBER_KEY_ESP32_MAC_ADDR && this.state.cyberKeyESP32Found === false) {
            console.log("ID du ESP32 Cyker key = ", peripheral.id)
            this.setState({
              cyberKeyESP32Found: true,
              cyberKeyESP32_peripheral: peripheral,
            })
        }
    }

    /**
     * Retourne vrai si il y a à l'heure courant un créneau disponible.
     */
    isThereACurrentEvent = () => {
        let currentDate = new Date()
        currentDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0)
        return (
            this.props.events.filter(e => {
                let startDate = new Date(e.start)
                let endDate = new Date(e.end)
                return (currentDate >= startDate && currentDate <= endDate)
            })
        )
    }

    /**
     * Modifie l'état graphique du composant pour montrer à l'utilisateur que l'application travaille.
     * @param {Boolean} isLoading actuellement en travail
     */
    loading = (isLoading) => {
        this.setState({loading: isLoading})
    }

    /**
     * Fonction enclanchant la procédure de déverrouillage de la porte, dans l'ordre :
     * - Si la connexion précédente s'est bien établie, lance la procédure d'authentification qui est :
     *      - Envoie à la serrure id_utilisateur_bdd est l'adresse mail sans les points
     *      - Attend une chaine challenge de la serrure
     *      - Chiffre la chaine challenge avec la clef privée de l'utilisateur contenue dans le SecureKeyStore puis l'envoie à la serrure
     *      - Attend la réponse de la serrure pour savoir si la signature a été validée ou non.
     * - Si la procédure d'authentification aboutie alors la serrure est déverrouillée et on informe l'utilisateur.
     */
    launchUnlockProcedure = () => {

        console.log(`Authentication procedure launched...`)
        let user_id_db = this.props.user.id.replace(/[.]/g, '')
        let keyTag = `${STORAGE_NAMING.PRIVATE_KEY_NAME}-${this.props.user.id}`
        //RSAKeychain.signWithAlgorithm(challenge, keyTag, RSAKeychain.SHA256withRSA).then(sig => console.log(sig)).catch(error => console.log(error))

        // Oblige d'exécuter cette méthode avant d'écrire ou de lire ...
        BleManager.retrieveServices(this.state.cyberKeyESP32_peripheral.id)
        .then((peripheralInfo) => {
            
            // Ecriture de l'id de l'utilisateur en BDD
            BleManager.write(
                this.state.cyberKeyESP32_peripheral.id,
                CYBERKEY_SERVICE_UUID,
                CHAR_UUID_RX_USER_ID,
                stringToBytes(user_id_db),
                MTU_SIZE
            )
            .then(() => {
                // Continuer le protocole ... ie. attendre une réponse sur tx_chall
                setTimeout(() => {
                    // Lecture du challange
                    BleManager.read(
                        this.state.cyberKeyESP32_peripheral.id,
                        CYBERKEY_SERVICE_UUID,
                        CHAR_UUID_TX_CHALL
                    )
                    .then((readData) => {
                        let challenge = bytesToString(readData)
                        console.log(`Received from tx_chall = "${challenge}"`)
                        // Ecriture de la signature de l'utilisateur
                        RSAKeychain.signWithAlgorithm(challenge, keyTag, RSAKeychain.SHA256withRSA).then((sig) => {
                            console.log(`Sig = ${base64ToHex(sig)}`)
                            BleManager.write(
                                this.state.cyberKeyESP32_peripheral.id,
                                CYBERKEY_SERVICE_UUID,
                                CHAR_UUID_RX_USER_SIG,
                                stringToBytes(base64ToHex(sig)),
                                MTU_SIZE
                            )
                            .then(() => {
                                // Ici, pendant ce temps l'ESP32 de la serrure consulte la BDD pour obtenir la clef publique de l'utilisateur afin
                                // de vérifier la signature envoyée précédemment.
                                // TODO : faire une timeout plus précis avec des tests pour savoir environ le nombre de ms nécessaires 
                                //        à l'ESP32 pour faire ces opérations.
                                setTimeout(() => {
                                    this.resetForReason("La porte est ouverte !")
                                }, 10000)
                                
                            })
                            .catch((error) => {
                                console.log(`[launchUnlockProcedure] write on rx_user_sig error = ${error}`)
                                this.resetForReason("Erreur de procédure, recommencer")
                            })
                        })
                    })
                    .catch((error) => {
                        console.log(`[launchUnlockProcedure] read from tx_chall error = ${error}`)
                        this.resetForReason("Erreur de procédure, recommencer")
                    })
                }, 10) // 10 ms (mis au hasard !!! ; voir pour être plus précis en faisant des tests)
                
            })
            .catch((error) => {
                console.log(`[launchUnlockProcedure] write on rx_user_id error = ${error}`)
                this.resetForReason("Erreur de procédure, recommencer")
            })
        })
        .catch(error => {
            console.log(`[launchUnlockProcedure] retrieveServices error = ${error}`)
            this.resetForReason("Erreur de procédure, recommencer")
        })
    }

    /**
     * Réinitialise l'état et affiche la raison (peut être dû à une erreur ou non !).
     * Affiche la raison à l'utilisateur sous la forme d'un Toast.
     * @param {string} msg raison du reset de l'état
     */
    resetForReason = (msg) => {
        if(this.state.connectedTo_cykerKeyESP32 === true) {
            BleManager.disconnect(this.state.cyberKeyESP32_peripheral.id)
                .then(() => {
                    console.log("Disconnected from CyberKey ESP32")
                    this.setState({
                        loading: false,
                        scanning: false, // état du scan BLE
                        cyberKeyESP32Found: false, // si l'ESP32 a été trouvé lors du scan
                        cyberKeyESP32_peripheral: null, // l'objet représentant le périphérique ESP32
                        connectedTo_cykerKeyESP32: false, // si on est connecté à l'ESP32
                    })
                    if(msg) Toast.show({text: msg})
                })
                .catch((error) => console.log(`[disconnectFromCyberKeyESP32] error = ${error}`))
        }
        else {
            this.setState({
                loading: false,
                scanning: false, // état du scan BLE
                cyberKeyESP32Found: false, // si l'ESP32 a été trouvé lors du scan
                cyberKeyESP32_peripheral: null, // l'objet représentant le périphérique ESP32
                connectedTo_cykerKeyESP32: false, // si on est connecté à l'ESP32
            })
            if(msg) Toast.show({text: msg})
        }
    }

    /**
     * Handler du bouton de déverrouillage.
     * - Demandes les permissions et d'activer le Bluetooth.
     * - Regarde si un créneau est actuellement en cours.
     * - Regarde si l'utilisateur a accès à ce créneau ou non.
     * - Scan les périphériques BLE alentours afin de se connecter à la serrure.
     */
    unlock = () => {

        this.checkPermissionsAndBT()
        .then(() => {
            this.loading(true)
            // Vérifie l'accès pour l'utilisateur
            if(this.props.user.isVIP) {
                this.beginBLEScanning() // démarre la procédure de déverrouillage (voir méthode beginBLEScanning)
                return;
            }

            let currentEvent = this.isThereACurrentEvent()[0]
            if(currentEvent === undefined) {
                Toast.show({text: "Aucun créneau n'est actuellement disponible !"})
                this.loading(false)
                return;
            }
            if(this.props.user.requestForEvents === undefined & this.props.user.acceptedForEvents === undefined) {
                Toast.show({text: "Accès non demandé !"})
                this.loading(false)
                return;
            }
            if(this.props.user.requestForEvents !== undefined & this.props.user.acceptedForEvents === undefined) {
                if(this.props.user.requestForEvents.filter(id => id === currentEvent.id).length > 0) {
                    Toast.show({text: "Accès à ce créneau en attente !"})
                    this.loading(false)
                    return;
                }
                else {
                    Toast.show({text: "Accès non demandé pour ce créneau !"})
                    this.loading(false)
                    return;
                }
            }
            if(this.props.user.requestForEvents === undefined & this.props.user.acceptedForEvents !== undefined) {
                if(this.props.user.acceptedForEvents.filter(id => id === currentEvent.id).length === 0) {
                    Toast.show({text: "Vous n'avez pas accès à ce créneau !"})
                    this.loading(false)
                    return;
                }
                else {
                    this.beginBLEScanning() // démarre la procédure de déverrouillage (voir méthode beginBLEScanning)
                    return;
                }
            }
            if(this.props.user.requestForEvents !== undefined & this.props.user.acceptedForEvents !== undefined) {
                if(this.props.user.requestForEvents.filter(id => id === currentEvent.id).length > 0) {
                    Toast.show({text: "Accès à ce créneau en attente !"})
                    this.loading(false)
                    return;
                }
                else {
                    if(this.props.user.acceptedForEvents.filter(id => id === currentEvent.id).length === 0) {
                        Toast.show({text: "Vous n'avez pas accès à ce créneau !"})
                        this.loading(false)
                        return;
                    }
                    else {
                        this.beginBLEScanning() // démarre la procédure de déverrouillage (voir méthode beginBLEScanning)
                        return;
                    }
                }
            }
        })
        .catch((error) => {
            console.log(error)
            this.resetForReason(error)
        })
    }

    /**
     * Méthode rendant un élément indiquant le chargement.
     */
    renderLoading = () => {
        if(this.state.loading) return <Spinner size={Dimensions.get("screen").width * 0.96} style={styles.loading} color="#FFBE00"/>
    }

    /**
     * Méthode rendant le bouton de déverouillage.
     */
    renderButton = () => {
        let text = "Déverrouillage"
        if(this.state.loading) {
            if(this.state.scanning) {
                text = "Scan des BLE..."
            }
            if(this.state.cyberKeyESP32Found) {
                text = "Connexion à la serrure..."
            }
            if(this.state.connectedTo_cykerKeyESP32) {
                text = "Authentification..."
            }
        }
        let disabled = this.state.loading
        return (
            <Button disabled={disabled} style={styles.unlockButton} onPress={this.unlock}>
                <Text>{text}</Text>
            </Button>
        )
    }
    
    /**
     * Méthode de rendu du composant.
     */
    render() {
        return (
        <Container style={styles.container}>
            {this.renderLoading()}
            {this.renderButton()}
        </Container>
        )
    }
}