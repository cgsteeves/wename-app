import * as Linking from "expo-linking";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SubPageHeader } from "@/components/SubPageHeader";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export default function TermsOfServiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.parchment }}>
      <SubPageHeader title="Terms of Service" subtitle="Last updated April 15, 2026" />
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 20,
        }}
      >
        <Section title="1. Acceptance of Terms" colors={colors}>
          <P colors={colors}>
            By downloading, installing, or using the WeName application ("App," "Service")
            operated by Christopher Steeves ("we," "our," or "us"), you agree to be bound by
            these Terms of Service ("Terms"). If you do not agree to these Terms, do not use
            the App.
          </P>
          <P colors={colors}>
            These Terms constitute a legally binding agreement between you and WeName. We may
            update these Terms from time to time. Continued use of the App after changes are
            posted constitutes your acceptance of the revised Terms.
          </P>
        </Section>

        <Section title="2. Description of Service" colors={colors}>
          <P colors={colors}>
            WeName is a collaborative baby name discovery application that allows users to swipe
            through curated baby name lists, save favourites, and discover names that both
            partners like. The App is available at wename.app and as a mobile web application.
          </P>
          <Bullet colors={colors}>
            Free Tier: Free accounts may swipe on a limited number of names per day and access
            core features. Daily limits reset every 24 hours.
          </Bullet>
          <Bullet colors={colors}>
            Premium Tier: Premium accounts receive unlimited daily swipes and access to
            additional name packs and features. Premium access is subject to any applicable fees
            disclosed at the time of purchase.
          </Bullet>
          <Bullet colors={colors}>
            Guest Usage: You may explore certain features of the App without creating an account.
            Guest users may have limited access to features, and their data may not be saved
            across sessions. We recommend creating an account to preserve your swipe history and
            access all features.
          </Bullet>
        </Section>

        <Section title="3. Subscription Billing" colors={colors}>
          <P colors={colors}>
            If you purchase a premium subscription, billing will be handled through the platform
            on which you downloaded the App (e.g., Apple App Store or Google Play Store). All
            payments are processed by the applicable platform provider and are subject to their
            respective terms and policies.
          </P>
          <P colors={colors}>
            All payments are non-refundable except as required by applicable law or the policies
            of the platform provider through which you made your purchase. Please review the
            refund policy of the applicable platform provider for more information.
          </P>
          <P colors={colors}>
            Subscriptions may auto-renew unless cancelled prior to the renewal date in accordance
            with the platform provider's cancellation policy. We do not process cancellations
            directly — cancellations must be managed through your App Store or Google Play
            account settings.
          </P>
        </Section>

        <Section title="4. Account Registration" colors={colors}>
          <P colors={colors}>
            You may use certain features of the App as a guest without creating an account. To
            access partner-linking, match history, and other personalized features, you must
            create an account by providing a valid email address.
          </P>
          <Bullet colors={colors}>You must be at least 13 years of age to create an account.</Bullet>
          <Bullet colors={colors}>
            You are responsible for maintaining the confidentiality of your account credentials.
          </Bullet>
          <Bullet colors={colors}>
            You agree to provide accurate and current information when creating your account.
          </Bullet>
          <Bullet colors={colors}>
            You are responsible for all activity that occurs under your account.
          </Bullet>
          <Bullet colors={colors}>
            You must notify us immediately at{" "}
            <InlineLink
              colors={colors}
              label="wenameapp@gmail.com"
              url="mailto:wenameapp@gmail.com"
            />{" "}
            if you suspect unauthorized use of your account.
          </Bullet>
        </Section>

        <Section title="5. Partner Linking" colors={colors}>
          <P colors={colors}>
            WeName allows you to link your account with a partner to discover names you both
            like. By linking with a partner:
          </P>
          <Bullet colors={colors}>
            You consent to sharing your liked names and matched names with your linked partner.
          </Bullet>
          <Bullet colors={colors}>
            Your partner will be able to see the names you have liked and any names you have
            matched on together.
          </Bullet>
          <Bullet colors={colors}>
            You may unlink from your partner at any time through the Partner section of Settings.
          </Bullet>
          <Bullet colors={colors}>
            Unlinking does not delete your individual swipe history or liked names.
          </Bullet>
          <P colors={colors}>
            You are solely responsible for the partner you choose to link with. WeName is not
            responsible for any disputes arising between you and your partner. WeName does not
            guarantee that you and your partner will reach agreement on any names or that the
            Service will produce outcomes that meet your expectations.
          </P>
        </Section>

        <Section title="6. Acceptable Use" colors={colors}>
          <P colors={colors}>You agree not to use the App to:</P>
          <Bullet colors={colors}>
            Violate any applicable local, provincial, national, or international law or
            regulation.
          </Bullet>
          <Bullet colors={colors}>
            Attempt to gain unauthorized access to any portion of the App or its related systems.
          </Bullet>
          <Bullet colors={colors}>
            Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source
            code of the App.
          </Bullet>
          <Bullet colors={colors}>
            Use automated scripts, bots, or other means to scrape or interact with the App in
            ways not intended by normal use.
          </Bullet>
          <Bullet colors={colors}>Transmit any viruses, malware, or other harmful code.</Bullet>
          <Bullet colors={colors}>
            Impersonate any person or entity, or falsely represent your affiliation with any
            person or entity.
          </Bullet>
          <Bullet colors={colors}>
            Use the App for any commercial purpose without our prior written consent.
          </Bullet>
          <P colors={colors}>
            We reserve the right to suspend or terminate your account at our sole discretion if
            we determine you have violated these Terms or engaged in conduct harmful to the App
            or other users.
          </P>
          <P colors={colors}>
            We reserve the right to enforce usage limits and prevent abuse of the Service,
            including excessive or automated usage that places an unreasonable burden on our
            infrastructure or degrades the experience of other users.
          </P>
        </Section>

        <Section title="7. Service Changes" colors={colors}>
          <P colors={colors}>
            We reserve the right to modify, suspend, or discontinue any part of the Service at
            any time without notice. This includes the addition, modification, or removal of
            features, name packs, or other content. We shall not be liable to you or any third
            party for any modification, suspension, or discontinuation of the Service or any part
            thereof.
          </P>
        </Section>

        <Section title="8. User-Generated Content" colors={colors}>
          <P colors={colors}>
            The App may allow you to submit custom baby names ("User Content"). By submitting
            User Content, you grant WeName a non-exclusive, royalty-free, worldwide licence to
            use, display, and process that content solely for the purpose of operating the App
            and providing the Service to you.
          </P>
          <P colors={colors}>
            You represent and warrant that any User Content you submit does not violate the
            rights of any third party, including intellectual property rights, privacy rights, or
            any applicable law.
          </P>
        </Section>

        <Section title="9. Intellectual Property" colors={colors}>
          <P colors={colors}>
            All content, features, and functionality of the App — including but not limited to
            the name database, AI suggestions, design, graphics, logos, and source code — are the
            exclusive property of WeName and its licensors and are protected by applicable
            copyright, trademark, and other intellectual property laws.
          </P>
          <P colors={colors}>
            These Terms do not grant you any right, title, or interest in the App or its content
            beyond the limited licence to use the Service for its intended personal,
            non-commercial purpose.
          </P>
        </Section>

        <Section title="10. Privacy" colors={colors}>
          <P colors={colors}>
            Your use of the App is also governed by our Privacy Policy, which is incorporated
            into these Terms by reference. Please review our Privacy Policy at{" "}
            <InlineLink
              colors={colors}
              label="wename.app/privacy"
              url="https://wename.app/privacy"
            />{" "}
            to understand our practices regarding the collection, use, and disclosure of your
            personal information.
          </P>
        </Section>

        <Section title="11. Third-Party Services" colors={colors}>
          <P colors={colors}>
            The App integrates with third-party services including Supabase (database and
            authentication), SendGrid (email delivery), and OpenAI (AI name suggestions). Your
            use of these features is also subject to the respective terms and privacy policies of
            those third parties. We are not responsible for the availability, accuracy, or
            practices of any third-party services.
          </P>
        </Section>

        <Section title="12. Disclaimer of Warranties" colors={colors}>
          <P colors={colors}>
            The App is provided on an "as is" and "as available" basis without warranties of any
            kind, either express or implied, including but not limited to implied warranties of
            merchantability, fitness for a particular purpose, or non-infringement.
          </P>
          <P colors={colors}>
            We do not warrant that the App will be uninterrupted, error-free, or free of viruses
            or other harmful components. We do not warrant the accuracy, completeness, or
            usefulness of any information provided through the App, including name meanings,
            origins, or pronunciations. WeName does not guarantee that you and your partner will
            reach agreement on any names or that the Service will produce outcomes that meet your
            expectations.
          </P>
        </Section>

        <Section title="13. Limitation of Liability" colors={colors}>
          <P colors={colors}>
            To the fullest extent permitted by applicable law, WeName and its owner shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages,
            including but not limited to loss of data, loss of profits, or loss of goodwill,
            arising out of or in connection with your use of or inability to use the App.
          </P>
          <P colors={colors}>
            In no event shall our total liability to you for any claims arising under these Terms
            exceed the greater of (a) the amount you have paid to us in the twelve months
            preceding the claim, or (b) CAD $10.
          </P>
        </Section>

        <Section title="14. Indemnification" colors={colors}>
          <P colors={colors}>
            You agree to indemnify, defend, and hold harmless WeName and its owner from and
            against any claims, liabilities, damages, losses, and expenses (including reasonable
            legal fees) arising out of or in any way connected with your access to or use of the
            App, your violation of these Terms, or your violation of any rights of another person
            or entity.
          </P>
        </Section>

        <Section title="15. Termination" colors={colors}>
          <P colors={colors}>
            You may stop using the App and delete your account at any time through the Account
            section of Settings. Upon account deletion, your personal data will be permanently
            removed from our systems as described in our Privacy Policy. Please note that some
            limited technical data may persist temporarily in backups or logs as described in our
            Privacy Policy.
          </P>
          <P colors={colors}>
            We reserve the right to suspend or terminate your access to the App at any time,
            with or without notice, for any reason including if we reasonably believe you have
            violated these Terms. Upon termination, your right to use the App will immediately
            cease.
          </P>
        </Section>

        <Section title="16. Governing Law and Dispute Resolution" colors={colors}>
          <P colors={colors}>
            These Terms are governed by and construed in accordance with the laws of the Province
            of Ontario and the federal laws of Canada applicable therein, without regard to
            conflict of law principles.
          </P>
          <P colors={colors}>
            Any dispute arising out of or relating to these Terms or your use of the App shall
            first be attempted to be resolved through good-faith negotiation. If the dispute
            cannot be resolved informally, it shall be submitted to the courts of competent
            jurisdiction in Ottawa, Ontario, Canada, and you consent to the exclusive
            jurisdiction of those courts.
          </P>
        </Section>

        <Section title="17. Changes to These Terms" colors={colors}>
          <P colors={colors}>
            We may revise these Terms at any time. When we make material changes, we will update
            the "Last Updated" date above and may provide notice through the App. Your continued
            use of the App following the posting of revised Terms constitutes your acceptance of
            the changes.
          </P>
          <P colors={colors}>
            We encourage you to review these Terms periodically to stay informed of any updates.
          </P>
        </Section>

        <Section title="18. Entire Agreement" colors={colors}>
          <P colors={colors}>
            These Terms constitute the entire agreement between you and WeName regarding the use
            of the Service and supersede all prior and contemporaneous agreements,
            representations, and understandings between you and WeName relating to the subject
            matter herein.
          </P>
        </Section>

        <Section title="19. Contact Us" colors={colors}>
          <P colors={colors}>
            If you have any questions, concerns, or feedback regarding these Terms, please
            contact us:
          </P>
          <P colors={colors}>Christopher Steeves (WeName){"\n"}Ottawa, Ontario, Canada</P>
          <LinkRow colors={colors} label="wenameapp@gmail.com" url="mailto:wenameapp@gmail.com" />
          <LinkRow colors={colors} label="wename.app" url="https://wename.app" />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text
        style={[
          styles.sectionTitle,
          { fontFamily: fonts.displayBold, color: colors.foreground },
        ]}
      >
        {title}
      </Text>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function P({
  colors,
  children,
}: {
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <Text
      style={{
        fontFamily: fonts.display,
        fontSize: 14,
        lineHeight: 22,
        color: colors.mutedForeground,
      }}
    >
      {children}
    </Text>
  );
}

function Bullet({
  colors,
  children,
}: {
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 14,
          lineHeight: 22,
          color: colors.mutedForeground,
        }}
      >
        {"•"}
      </Text>
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.display,
          fontSize: 14,
          lineHeight: 22,
          color: colors.mutedForeground,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

function LinkRow({
  colors,
  label,
  url,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  url: string;
}) {
  return (
    <Pressable onPress={() => Linking.openURL(url)}>
      <Text
        style={{
          fontFamily: fonts.displaySemibold,
          fontSize: 14,
          color: colors.rose,
          textDecorationLine: "underline",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InlineLink({
  colors,
  label,
  url,
}: {
  colors: ReturnType<typeof useColors>;
  label: string;
  url: string;
}) {
  return (
    <Text
      onPress={() => Linking.openURL(url)}
      style={{
        fontFamily: fonts.displaySemibold,
        fontSize: 14,
        color: colors.rose,
        textDecorationLine: "underline",
      }}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
});
