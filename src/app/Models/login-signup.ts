export interface Users {
    userID:     number;
    name:       string;
    username:   string;
    image:      string;
    createDate: string;
    bio:        string;
    type:       string;
    profileImageURL: string;
    password:   string;
  }

  export interface SignupData {
    username: string;
    password: string;
    name:       string;
    type:     string;
    image:      string;
    file:    File;
  }
