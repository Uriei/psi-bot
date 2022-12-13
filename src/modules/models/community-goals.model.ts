export interface ICommunityGoalsXML {
  data: {
    activeInitiatives: { item: Array<ICommunityGoalItem> };
  };
}

export interface ICommunityGoalItem {
  id: string;
  title: string;
  expiry: string;
  market_name: string;
  starsystem_name: string;
  activityType: string;
  target_commodity_list: string;
  target_qty: string;
  qty: string;
  objective: string;
  images: string;
  news: string;
  bulletin: string;
}

export interface ICommunityGoalDB {
  id: string;
  title: string;
  expiry: Date;
  market_name: string;
  starsystem_name: string;
  activityType: string;
  target_commodity_list: Array<string>;
  target_qty: number;
  qty: number;
  objective: string;
  images: string;
  bulletin: string;
}
export interface ICommunityGoalMessageDB {
  communityGoalId: string;
  messageId: string;
  communityGoal: ICommunityGoalDB;
}
