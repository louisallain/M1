import React, { Component } from "react";
import { Alert, BackHandler } from "react-native";
import { Root, Toast } from "native-base";
import auth from '@react-native-firebase/auth';
import SignIn from '../Account/SignIn/SignIn';
import LogIn from '../Account/LogIn/LogIn';
import Home from '../Home/Home';

import * as PAGES from '../utils/pages';

/**
 * Conteneur principal de l'application.
 */
class App extends Component {

  /**
   * Constructeur du composant.
   * @param {Object} props propriétés du composant
   */
  constructor(props) {
    super(props)
    this.state = {
      current_page: PAGES.ACCOUNT_LOG_IN
    }
  }

  /**
   * Méthode déconnectant l'utilisateur courant.
   */
  signOut = () => {
    auth().signOut()
  }

  /**
   * Modifie la page courante.
   * @param {string} page nom de la page devant être affichée (voir le fichier src/utils/pages.js)
   */
  switchToPage = (page) => {
    this.setState({current_page: page})
  }

  /**
   * Handler du bouton retour du mobile.
   */
  handleBackButton = () => {
    if(this.state.current_page === PAGES.ACCOUNT_SIGN_IN) {
      this.switchToPage(PAGES.ACCOUNT_LOG_IN)
      return true
    }
    else if(this.state.current_page === PAGES.HOME) {
      Alert.alert(
        "Déconnexion",
        "Se déconnecter ?",
        [
            {
                text: 'Ok',
                onPress: () => this.signOut()
            },
            {
                text: 'Annuler',
                onPress: () => Toast.show({text: "Annulation !"}),
                style: 'cancel'
            }
        ],
        { cancelable: false }
      )
      return true
    }
    else {
      BackHandler.exitApp()
      return true
    }
  }

  /**
   * Méthode exécutée après le rendu du composant.
   * Ajoute un listener sur l'état de connexion.
   * Ajoute un listener sur le bouton back du téléphone (dans le cas où on est sur la page de création de compte, ce bouton fait revenir sur la page de connexion.)
   */
  componentDidMount() {
    auth().onAuthStateChanged((user) => {
      if(user) this.setState({current_page: PAGES.HOME})
      else this.setState({current_page: PAGES.ACCOUNT_LOG_IN})
    })
    
    BackHandler.addEventListener("hardwareBackPress", this.handleBackButton)
  }

  componentWillUnmount() {
    BackHandler.removeEventListener("hardwareBackPress", this.handleBackButton)
  }

  /**
   * Méthode de rendu du composant.
   */
  render() {
    
    let content

    switch(this.state.current_page) {

      case PAGES.ACCOUNT_LOG_IN: {
        content = <LogIn switchToPage={this.switchToPage}/>
        break;
      }

      case PAGES.ACCOUNT_SIGN_IN: {
        content = <SignIn />
        break;
      }

      case PAGES.HOME:{
        content = <Home />
        break;
      }

      default:
        content = <LogIn />
        break;
    }

    return (
      <Root>
        {content}
      </Root>
    )
  }
}

export default App;