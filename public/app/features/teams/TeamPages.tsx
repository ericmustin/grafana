import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { includes } from 'lodash';
import { Themeable2, withTheme2 } from '@grafana/ui';
import config from 'app/core/config';
import Page from 'app/core/components/Page/Page';
import TeamMembers from './TeamMembers';
import TeamPermissions from './TeamPermissions';
import TeamSettings from './TeamSettings';
import TeamGroupSync, { TeamSyncUpgradeContent } from './TeamGroupSync';
import { AccessControlAction, StoreState } from 'app/types';
import { loadTeam, loadTeamMembers } from './state/actions';
import { getTeam, getTeamMembers, isSignedInUserTeamAdmin } from './state/selectors';
import { getTeamLoadingNav } from './state/navModel';
import { getNavModel } from 'app/core/selectors/navModel';
import { contextSrv } from 'app/core/services/context_srv';
import { NavModel } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { UpgradeBox } from 'app/core/components/Upgrade/UpgradeBox';

interface TeamPageRouteParams {
  id: string;
  page: string | null;
}

export interface OwnProps extends GrafanaRouteComponentProps<TeamPageRouteParams>, Themeable2 {}

interface State {
  isSyncEnabled: boolean;
  isLoading: boolean;
}

enum PageTypes {
  Members = 'members',
  Settings = 'settings',
  GroupSync = 'groupsync',
}

function mapStateToProps(state: StoreState, props: OwnProps) {
  const teamId = parseInt(props.match.params.id, 10);
  const team = getTeam(state.team, teamId);
  let defaultPage = 'members';
  if (contextSrv.accessControlEnabled()) {
    // With FGAC the settings page will always be available
    if (!team || !contextSrv.hasPermissionInMetadata(AccessControlAction.ActionTeamsPermissionsRead, team)) {
      defaultPage = 'settings';
    }
  }
  const pageName = props.match.params.page ?? defaultPage;
  const teamLoadingNav = getTeamLoadingNav(pageName as string);
  const navModel = getNavModel(state.navIndex, `team-${pageName}-${teamId}`, teamLoadingNav);
  const members = getTeamMembers(state.team);

  return {
    navModel,
    teamId: teamId,
    pageName: pageName,
    team,
    members,
    editorsCanAdmin: config.editorsCanAdmin, // this makes the feature toggle mockable/controllable from tests,
    signedInUser: contextSrv.user, // this makes the feature toggle mockable/controllable from tests,
  };
}

const mapDispatchToProps = {
  loadTeam,
  loadTeamMembers,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

export class TeamPages extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      isLoading: false,
      isSyncEnabled: featureEnabled('teamsync'),
    };
  }

  async componentDidMount() {
    await this.fetchTeam();
  }

  async fetchTeam() {
    const { loadTeam, teamId } = this.props;
    this.setState({ isLoading: true });
    const team = await loadTeam(teamId);
    // With accesscontrol, the TeamPermissions will fetch team members
    if (!contextSrv.accessControlEnabled()) {
      await this.props.loadTeamMembers();
    }
    this.setState({ isLoading: false });
    return team;
  }

  getCurrentPage() {
    const pages = ['members', 'settings', 'groupsync'];
    const currentPage = this.props.pageName;
    return includes(pages, currentPage) ? currentPage : pages[0];
  }

  textsAreEqual = (text1: string, text2: string) => {
    if (!text1 && !text2) {
      return true;
    }

    if (!text1 || !text2) {
      return false;
    }

    return text1.toLocaleLowerCase() === text2.toLocaleLowerCase();
  };

  hideTabsFromNonTeamAdmin = (navModel: NavModel, isSignedInUserTeamAdmin: boolean) => {
    if (contextSrv.accessControlEnabled()) {
      return navModel;
    }

    if (!isSignedInUserTeamAdmin && navModel.main && navModel.main.children) {
      navModel.main.children
        .filter((navItem) => !this.textsAreEqual(navItem.text, PageTypes.Members))
        .map((navItem) => {
          navItem.hideFromTabs = true;
        });
    }

    return navModel;
  };

  renderPage(isSignedInUserTeamAdmin: boolean): React.ReactNode {
    const { isSyncEnabled } = this.state;
    const { members, team } = this.props;
    const currentPage = this.getCurrentPage();

    const canReadTeam = contextSrv.hasAccessInMetadata(
      AccessControlAction.ActionTeamsRead,
      team!,
      isSignedInUserTeamAdmin
    );
    const canReadTeamPermissions = contextSrv.hasAccessInMetadata(
      AccessControlAction.ActionTeamsPermissionsRead,
      team!,
      isSignedInUserTeamAdmin
    );
    const canWriteTeamPermissions = contextSrv.hasAccessInMetadata(
      AccessControlAction.ActionTeamsPermissionsWrite,
      team!,
      isSignedInUserTeamAdmin
    );

    switch (currentPage) {
      case PageTypes.Members:
        if (contextSrv.accessControlEnabled()) {
          return <TeamPermissions team={team!} />;
        } else {
          return <TeamMembers syncEnabled={isSyncEnabled} members={members} />;
        }
      case PageTypes.Settings:
        return canReadTeam && <TeamSettings team={team!} />;
      case PageTypes.GroupSync:
        if (isSyncEnabled) {
          if (canReadTeamPermissions) {
            return <TeamGroupSync isReadOnly={!canWriteTeamPermissions} />;
          }
        } else if (config.featureToggles.featureHighlights) {
          return (
            <>
              <UpgradeBox featureName={'team sync'} featureId={'team-sync'} />
              <TeamSyncUpgradeContent />
            </>
          );
        }
    }

    return null;
  }

  render() {
    const { team, navModel, members, editorsCanAdmin, signedInUser } = this.props;
    const isTeamAdmin = isSignedInUserTeamAdmin({ members, editorsCanAdmin, signedInUser });

    return (
      <Page navModel={this.hideTabsFromNonTeamAdmin(navModel, isTeamAdmin)}>
        <Page.Contents isLoading={this.state.isLoading}>
          {team && Object.keys(team).length !== 0 && this.renderPage(isTeamAdmin)}
        </Page.Contents>
      </Page>
    );
  }
}

export default connector(withTheme2(TeamPages));
