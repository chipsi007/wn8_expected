#WN8 Expected Values Updater by Gryphon
memory.limit(size=100000)

#load data from csv file on HDD
dataMaster <- read.csv("input.csv") #this is the datafile of user accounts, one row per user/tank
any(is.na(dataMaster))
head(dataMaster)
nrow(dataMaster)

#apply filters as needed
userTankStats <- dataMaster

userTankStats$damage_dealt <- as.double(userTankStats$damage_dealt)
userTankStats <- userTankStats[,c("userid", "compDescr","title", 
                                  "type", "tier", "countryid", "battles",
                                  "victories","damage_dealt","frags",
                                  "spotted","defence_points")]
userTankStats$userid <- as.factor(userTankStats$userid)
any(is.na(userTankStats))

# number of battles in dataset
sum(userTankStats$battles)

#calc actuals
userTankStats$aFRAG <- userTankStats$frags/userTankStats$battles
userTankStats$aDAMAGE <- userTankStats$damage_dealt/userTankStats$battles
userTankStats$aSPOT <- userTankStats$spotted/userTankStats$battles
userTankStats$aDEF <- userTankStats$defence_points/userTankStats$battles
userTankStats$aWIN <- 100*userTankStats$victories/userTankStats$battles
any(is.na(userTankStats))


#load current expected values from wnefficiency.net - currently version 30
wnefficiencyURL <- "expected.csv"
expectedValues <- read.csv(wnefficiencyURL)
names(expectedValues) <- c("compDescr", "eFRAG", "eDAMAGE","eSPOT", "eDEF", "eWIN")

head(expectedValues)
any(is.na(expectedValues))

# add the expected values data to the user tanks data
require(dplyr)
userTankStats <- inner_join(x=userTankStats, y=expectedValues, by = c("compDescr") )

# fix chars that upset file naming
userTankStats$title <- chartr("*/", "_-", userTankStats$title)
any(is.na(userTankStats))

# calculate the user rSTATS
userTankStats$rFRAG <- userTankStats$aFRAG/userTankStats$eFRAG
userTankStats$rDAMAGE <- userTankStats$aDAMAGE/userTankStats$eDAMAGE
userTankStats$rSPOT <- userTankStats$aSPOT/userTankStats$eSPOT
userTankStats$rDEF <- userTankStats$aDEF/userTankStats$eDEF
userTankStats$rWIN <- userTankStats$aWIN/userTankStats$eWIN
userTankStats$rFRAGproduct <- userTankStats$rFRAG * userTankStats$battles
userTankStats$rDAMAGEproduct <- userTankStats$rDAMAGE * userTankStats$battles
userTankStats$rSPOTproduct <- userTankStats$rSPOT * userTankStats$battles
userTankStats$rDEFproduct <- userTankStats$rDEF * userTankStats$battles
userTankStats$rWINproduct <- userTankStats$rWIN * userTankStats$battles
any(is.na(userTankStats))

# calculate the user rSTATc's
userTankStats$rWINc <- pmax(0,(userTankStats$rWIN - 0.71)/(1 - 0.71))
userTankStats$rDAMAGEc <- pmax(0,(userTankStats$rDAMAGE - 0.22)/(1 - 0.22))
userTankStats$rFRAGc <- pmax(0,pmin(userTankStats$rDAMAGEc + 0.2,((userTankStats$rFRAG - 0.12)/(1 - 0.12))))
userTankStats$rSPOTc <- pmax(0,pmin(userTankStats$rDAMAGEc + 0.1,((userTankStats$rSPOT - 0.38)/(1 - 0.38))))
userTankStats$rDEFc <- pmax(0,pmin(userTankStats$rDAMAGEc + 0.1,((userTankStats$rDEF - 0.10)/(1 - 0.10))))
userTankStats$rWINcproduct <- userTankStats$rWINc * userTankStats$battles
userTankStats$rDAMAGEcproduct <- userTankStats$rDAMAGEc * userTankStats$battles
userTankStats$rFRAGcproduct <- userTankStats$rFRAGc * userTankStats$battles
userTankStats$rSPOTcproduct <- userTankStats$rSPOTc * userTankStats$battles
userTankStats$rDEFcproduct <- userTankStats$rDEFc * userTankStats$battles
any(is.na(userTankStats))

# calculate the user WN8 per tank 
userTankStats$WN8 <- with(userTankStats, 980*rDAMAGEc + 210*rDAMAGEc*rFRAGc + 155*rFRAGc*rSPOTc + 75*rDEFc*rFRAGc + 145*pmin(1.8,rWINc))
userTankStats$WN8product <- userTankStats$battles * userTankStats$WN8
any(is.na(userTankStats))

# filter out all tanks where WN8 is below median WN8 for every users' tanks
require(dplyr)
median.userTankStatsWN8 <- summarize(group_by(userTankStats,userid), median_WN8 = median(WN8, na.rm=TRUE))
userTankStatsFiltered <- inner_join(x=userTankStats, y=median.userTankStatsWN8, by = "userid")
userTankStatsFiltered <- userTankStatsFiltered[userTankStatsFiltered$WN8 >= userTankStatsFiltered$median_WN8,]
nrow(userTankStatsFiltered)
any(is.na(userTankStatsFiltered))
rm(median.userTankStatsWN8)

#calculate the user account WN8, rSTATs, and rSTATSc
require(dplyr)
userAccountStats <- summarize(group_by(userTankStatsFiltered, userid), 
                              WN8product = sum(WN8product),
                              rWINproduct = sum(rWINproduct), 
                              rDAMAGEproduct = sum(rDAMAGEproduct),
                              rFRAGproduct = sum(rFRAGproduct), 
                              rSPOTproduct = sum(rSPOTproduct), 
                              rDEFproduct = sum(rDEFproduct),
                              rWINcproduct = sum(rWINcproduct), 
                              rDAMAGEcproduct = sum(rDAMAGEcproduct),
                              rFRAGcproduct = sum(rFRAGcproduct), 
                              rSPOTcproduct = sum(rSPOTcproduct), 
                              rDEFcproduct = sum(rDEFcproduct),
                              battles = sum(battles))

userAccountStats$user_WN8 <- userAccountStats$WN8product / userAccountStats$battles
userAccountStats$user_rWIN <- userAccountStats$rWINproduct / userAccountStats$battles
userAccountStats$user_rDAMAGE <- userAccountStats$rDAMAGEproduct / userAccountStats$battles
userAccountStats$user_rFRAG <- userAccountStats$rFRAGproduct / userAccountStats$battles
userAccountStats$user_rSPOT <- userAccountStats$rSPOTproduct / userAccountStats$battles
userAccountStats$user_rDEF <- userAccountStats$rDEFproduct / userAccountStats$battles
userAccountStats$user_rWINc <- userAccountStats$rWINcproduct / userAccountStats$battles
userAccountStats$user_rDAMAGEc <- userAccountStats$rDAMAGEcproduct / userAccountStats$battles
userAccountStats$user_rFRAGc <- userAccountStats$rFRAGcproduct / userAccountStats$battles
userAccountStats$user_rSPOTc <- userAccountStats$rSPOTcproduct / userAccountStats$battles
userAccountStats$user_rDEFc <- userAccountStats$rDEFcproduct / userAccountStats$battles

userAccountStats <- userAccountStats[,c("userid",  "user_WN8", "user_rWIN", "user_rDAMAGE", "user_rFRAG", "user_rSPOT", "user_rDEF", "user_rWINc", "user_rDAMAGEc", "user_rFRAGc", "user_rSPOTc", "user_rDEFc")]
any(is.na(userAccountStats))

#merge back
require(dplyr)
userTankStatsFiltered <- inner_join(x=userTankStatsFiltered, y=userAccountStats, by = c("userid"))
any(is.na(userTankStatsFiltered))

# create table of compDescr and title as index for the loop
require(dplyr)
listOfTanks <- summarize(group_by(userTankStatsFiltered, compDescr, title ), users = n() )
any(is.na(listOfTanks))

# loop to do linear regression for each rSTAT vs user account rSTAT, derive corrected expected values
newExpectedValues <- expectedValues

for (i in listOfTanks$compDescr){
    sample <- userTankStatsFiltered[userTankStatsFiltered$compDescr == i,]
    rDAMAGEmodel <- lm(rDAMAGE ~ user_rDAMAGE, data=sample, weights=battles)
    rDAMAGEcorrection <- rDAMAGEmodel$coef[[1]] + rDAMAGEmodel$coef[[2]]
    eDAMAGE_new <- round(rDAMAGEcorrection * expectedValues$eDAMAGE[expectedValues$compDescr == i], 2)
    newExpectedValues$eDAMAGE[newExpectedValues$compDescr == i] <- eDAMAGE_new
    rFRAGmodel <- lm(rFRAG ~ user_rFRAG, data=sample, weights=battles)
    rFRAGcorrection <- rFRAGmodel$coef[[1]] + rFRAGmodel$coef[[2]]
    eFRAG_new <- round(rFRAGcorrection * expectedValues$eFRAG[expectedValues$compDescr == i], 2)
    newExpectedValues$eFRAG[newExpectedValues$compDescr == i] <- eFRAG_new
    rSPOTmodel <- lm(rSPOT ~ user_rSPOT, data=sample, weights=battles)
    rSPOTcorrection <- rSPOTmodel$coef[[1]] + rSPOTmodel$coef[[2]]
    eSPOT_new <- round(rSPOTcorrection * expectedValues$eSPOT[expectedValues$compDescr == i], 2)
    newExpectedValues$eSPOT[newExpectedValues$compDescr == i] <- eSPOT_new
    rDEFmodel <- lm(rDEF ~ user_rDEF, data=sample, weights=battles)
    rDEFcorrection <- rDEFmodel$coef[[1]] + rDEFmodel$coef[[2]]
    eDEF_new <- round(rDEFcorrection * expectedValues$eDEF[expectedValues$compDescr == i], 2)
    newExpectedValues$eDEF[newExpectedValues$compDescr == i] <- eDEF_new
    rWINmodel <- lm(rWIN ~ user_rWIN, data=sample, weights=battles)
    rWINcorrection <- rWINmodel$coef[[1]] + rWINmodel$coef[[2]]
    eWIN_new <- round(rWINcorrection * expectedValues$eWIN[expectedValues$compDescr == i], 2)
    newExpectedValues$eWIN[newExpectedValues$compDescr == i] <- eWIN_new
	
    newExpectedValues$title[newExpectedValues$compDescr == i] <- listOfTanks[listOfTanks$compDescr == i,]$title
}


any(is.na(newExpectedValues))
newExpectedValues <- newExpectedValues[,c("compDescr","eFRAG", "eDAMAGE", "eSPOT", "eDEF",  "eWIN", "title")]

#export new values
date <- as.Date(Sys.Date(), "%m/%d/%Y" )
expected_value_filename <- paste("output",date,".csv")
write.csv(x=newExpectedValues,file=expected_value_filename ,row.names = FALSE)