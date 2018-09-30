import React, {Component} from 'react';


import PropTypes from 'prop-types';

import {auth} from 'steem';

import {Button, Divider, Input, message} from 'antd';
import {FormattedHTMLMessage, FormattedMessage, injectIntl} from 'react-intl';

import scLogo from '../../img/steem-connect.svg';
import logo from '../../img/logo-big.png';

import {getAccounts} from '../../backend/steem-client';


import {scLogin} from '../../helpers/sc';
import UserAvatar from "../elements/UserAvatar";


class Settings extends Component {
  constructor(props) {
    super(props);

    this.state = {
      processing: false
    }
  }

  switchToAccount = (username) => {
    const {actions, onLogin} = this.props;
    actions.activateAccount(username);
    onLogin();
  };

  steemConnectLogin = () => {
    scLogin().then((resp) => {
      const {actions, onLogin} = this.props;
      actions.addAccountSc(resp.username, resp.access_token, resp.expires_in);
      onLogin();
      return resp
    }).catch(() => {

    })
  };

  async doLogin() {
    const {intl} = this.props;

    const username = document.querySelector('#txt-username').value.trim();
    const code = document.querySelector('#txt-code').value.trim();

    if (username === '' || code === '') {
      message.error(
        intl.formatMessage({id: 'login.error-fields-required'})
      );
      return false;
    }

    // Warn user if entered a public key
    if (auth.isPubkey(code)) {
      message.error(
        intl.formatMessage({id: 'login.error-public-key'})
      );
      return false;
    }

    // True if the code entered is password else false
    let codeIsPassword = !auth.isWif(code);
    let accounts;

    this.setState({processing: true});
    try {
      accounts = await getAccounts([username]);
    } catch (err) {
      message.error(
        intl.formatMessage({id: 'login.error-user-fetch'})
      );
      return
    } finally {
      this.setState({processing: false});
    }

    // User not found
    if (accounts && accounts.length === 0) {
      message.error(
        intl.formatMessage({id: 'login.error-user-not-found'})
      );
      return false;
    }

    let rUser = accounts[0];

    // Public keys of user
    let rUserPublicKeys = {
      active: rUser['active'].key_auths.map(x => x[0]),
      memo: [rUser['memo_key']],
      owner: rUser['owner'].key_auths.map(x => x[0]),
      posting: rUser['posting'].key_auths.map(x => x[0])
    };

    let loginFlag = false;
    const resultKeys = {active: null, memo: null, owner: null, posting: null};

    if (codeIsPassword) {
      // With master password

      // Get all private keys by username and password
      const username = rUser.name;
      const userKeys = auth.getPrivateKeys(username, code);

      // Compare remote user keys and generated keys
      for (let k  in rUserPublicKeys) {
        const k2 = `${k}Pubkey`;

        const v = rUserPublicKeys[k];
        const v2 = userKeys[k2];

        // Append matched keys to result dict
        if (v.includes(v2)) {
          loginFlag = true;
          resultKeys[k] = userKeys[k];
        }
      }
    } else {
      // With wif
      let publicWif = auth.wifToPublic(code);

      for (let k  in rUserPublicKeys) {
        let v = rUserPublicKeys[k];
        if (v.includes(publicWif)) {
          loginFlag = true;
          resultKeys[k] = code;
          break;
        }
      }
    }

    if (!loginFlag) {
      message.error(
        intl.formatMessage({id: 'login.error-authenticate'})
      );
      return false;
    }

    const {actions, onLogin} = this.props;
    actions.addAccount(username, resultKeys);
    onLogin();
  }


  render() {
    const {global, accounts, intl} = this.props;
    const {processing} = this.state;

    const {list: accountList} = accounts;


    return (
      <div className="login-dialog-content">
        <div className="login-header">
          <div className="logo">
            <img src={logo}/>
          </div>

          <div className="login-header-text"> Welcome back!</div>

        </div>

        {accountList.length > 0 &&
        <div className="account-list">
          <div className="account-list-header">Login As</div>
          <div className="account-list-body">
            {accountList.map((account) => (
              <div key={account.username} className="account-list-item" onClick={() => {
                this.switchToAccount(account.username)
              }}>
                <UserAvatar user={account.username} size="normal"/> <span
                className="username">@{account.username}</span>
              </div>
            ))}
          </div>
        </div>
        }

        {accountList.length > 0 && <Divider>OR</Divider>}

        <div className="login-form">
          <p><FormattedMessage id="login.traditional-login-desc"/></p>
          <p>
            <Input size="large" type="text" autoFocus id="txt-username" addonBefore={'@'}
                   placeholder={intl.formatMessage(
                     {id: 'login.username'}
                   )}/>
          </p>
          <p>
            <Input size="large" type="password" id="txt-code" placeholder={intl.formatMessage(
              {id: 'login.password'}
            )}/>
          </p>
          <p>
            <Button size="large" htmlType="button" type="primary" block disabled={processing} onClick={() => {
              this.doLogin()
            }}><FormattedMessage id="login.login"/></Button>
          </p>

          <p><FormattedHTMLMessage id="login.create-account-text"/></p>
        </div>
        <Divider>OR</Divider>
        <div className="login-sc" onClick={this.steemConnectLogin}>
          <p><FormattedMessage id="login.login-with-sc"/></p>
          <div className="logo"><img src={scLogo}/></div>
        </div>
      </div>
    );
  }
}

Settings.propTypes = {
  actions: PropTypes.shape({
    addAccount: PropTypes.func.isRequired,
    addAccountSc: PropTypes.func.isRequired,
    deleteAccount: PropTypes.func.isRequired,
    activateAccount: PropTypes.func.isRequired
  }).isRequired,
  onLogin: PropTypes.func.isRequired,
  global: PropTypes.shape({}).isRequired,
  accounts: PropTypes.shape({
    activeAccount: PropTypes.instanceOf(Object),
    list: PropTypes.arrayOf(PropTypes.object).isRequired
  }).isRequired,
  intl: PropTypes.instanceOf(Object).isRequired
};

export default injectIntl(Settings);
