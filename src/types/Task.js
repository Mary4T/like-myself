// 定義任務的類型結構
export interface Task {
    id: string;
    title: string;          // 任務名稱
    icon: {                 // 任務圖示
      type: 'default' | 'custom';
      url: string;
    };
    progress: number;       // 任務進度 (0-100)
    deadline: {            // 截止日期
      date: string;
      time: string;
      reminders: {
        value: number;
        unit: 'year' | 'month' | 'day' | 'hour' | 'minute';
      }[];
    };
    location: {            // 地點
      name: string;
      googleMapsUrl: string;
    };
    description: {         // 任務描述
      content: string;     // 富文本內容
      drawings: string[];  // 手繪內容
      attachments: {       // 附件
        type: 'image' | 'video' | 'table';
        url: string;
      }[];
    };
    links: {              // 超連結
      text: string;
      url: string;
      icon?: string;
    }[];
    subtasks: {           // 子任務
      id: string;
      title: string;
      icon: string;
      completed: boolean;
    }[];
    cheerPoints: {        // 集氣條
      current: number;
      records: {
        text: string;
        timestamp: string;
      }[];
    };
  }