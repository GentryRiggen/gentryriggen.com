import React from 'react';
import theme from '../../application/common/theme';
import FontAwesome from 'react-fontawesome';
import P from '../../application/components/P';

const styles = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  image: {
    width: 250,
    height: 250,
    borderRadius: '50%',
    marginBottom: 24,
  },
  social: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  socialItem: {
    color: theme.colors.textColor,
    padding: 8,
  },
};

const Home = () => (
  <div style={styles.content}>
    <img
      src="images/profile.jpg"
      style={styles.image}
      alt="Sexy Gentry Riggen"
    />
    <P>Hello! I am software developer who develops dope applications in the web and mobile space.</P>
    <P>My current vices are React, React Native, Node and Firebase. I like, don't love, PHP, MYSQL, Angular.js, and C#.</P>
    <P>I am available for contract. DM me on Twitter.</P>

    <div style={styles.social}>
      <a
        href="https://twitter.com/gentryriggen"
        target="_blank"
        style={styles.socialItem}
      >
        <FontAwesome
          name="twitter"
          size="2x"
        />
      </a>
      <a
        href="https://github.com/gentryriggen"
        target="_blank"
        style={styles.socialItem}
      >
        <FontAwesome
          name="github"
          size="2x"
        />
      </a>
      <a
        href="https://linkedin.com/in/GentryRiggen/en"
        target="_blank"
        style={styles.socialItem}
      >
        <FontAwesome
          name="linkedin"
          size="2x"
        />
      </a>
      <a
        href="http://stackoverflow.com/users/1767285"
        target="_blank"
        style={styles.socialItem}
      >
        <FontAwesome
          name="stack-overflow"
          size="2x"
        />
      </a>
    </div>
  </div>
);

export default Home
